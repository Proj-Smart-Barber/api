import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface SanitizedQueryMetric {
  fingerprint: string;
  durationMs: number;
  isLockQuery: boolean;
}

export interface RequestMetricsStore {
  requestId: string;
  startedAtMs: number;
  sqlCount: number;
  sqlDurationMs: number;
  lockQueryMs: number;
  poolAcquireWaitMs: number;
  queries: SanitizedQueryMetric[];
}

const metricsStorage = new AsyncLocalStorage<RequestMetricsStore>();

export function sanitizeSqlFingerprint(sqlText: string): string {
  const normalized = sqlText
    .replace(/\s+/g, " ")
    .replace(/'[^']*'/g, "?")
    .replace(/\b\d+(\.\d+)?\b/g, "?")
    .trim()
    .slice(0, 4000);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function isLockSql(sqlText: string): boolean {
  const upper = sqlText.toUpperCase();
  return (
    upper.includes("FOR UPDATE") ||
    upper.includes("PG_ADVISORY_XACT_LOCK") ||
    upper.includes("PG_TRY_ADVISORY_LOCK")
  );
}

export function runWithRequestMetrics<T>(
  fn: () => T,
  requestId: string = randomUUID(),
): T {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const store: RequestMetricsStore = {
    requestId,
    startedAtMs: now,
    sqlCount: 0,
    sqlDurationMs: 0,
    lockQueryMs: 0,
    poolAcquireWaitMs: 0,
    queries: [],
  };
  return metricsStorage.run(store, fn);
}

export function getRequestMetrics(): RequestMetricsStore | undefined {
  return metricsStorage.getStore();
}

export function recordSqlExecution(sqlText: string, durationMs: number): void {
  const store = metricsStorage.getStore();
  if (!store) return;
  const normalized = typeof sqlText === "string" ? sqlText : String(sqlText);
  const lockQuery = isLockSql(normalized);
  store.sqlCount += 1;
  store.sqlDurationMs += durationMs;
  if (lockQuery) {
    store.lockQueryMs += durationMs;
  }
  if (store.queries.length < 250) {
    store.queries.push({
      fingerprint: sanitizeSqlFingerprint(normalized),
      durationMs: Number(durationMs.toFixed(3)),
      isLockQuery: lockQuery,
    });
  }
}

export function recordPoolAcquireWait(durationMs: number): void {
  const store = metricsStorage.getStore();
  if (!store) return;
  store.poolAcquireWaitMs += durationMs;
}

export function formatServerTimingHeader(store: RequestMetricsStore): string {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const totalMs = Math.max(0, now - store.startedAtMs);
  return [
    `total;dur=${totalMs.toFixed(2)}`,
    `db;dur=${store.sqlDurationMs.toFixed(2)};desc="sql=${store.sqlCount}"`,
    `lock_query;dur=${store.lockQueryMs.toFixed(2)}`,
    `pool;dur=${store.poolAcquireWaitMs.toFixed(2)}`,
  ].join(", ");
}

export function requestMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_REQUEST_METRICS !== "true"
  ) {
    next();
    return;
  }
  const requestId = randomUUID();

  runWithRequestMetrics(() => {
    const store = getRequestMetrics();
    res.setHeader("X-Request-Id", requestId);

    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = function (
      statusCode: number,
      ...args: any[]
    ): ReturnType<typeof res.writeHead> {
      if (store && !res.headersSent) {
        res.setHeader("Server-Timing", formatServerTimingHeader(store));
        if (
          process.env.NODE_ENV !== "production" ||
          process.env.ENABLE_REQUEST_METRICS === "true"
        ) {
          res.setHeader("X-SQL-Count", String(store.sqlCount));
          res.setHeader("X-SQL-Duration-Ms", store.sqlDurationMs.toFixed(2));
        }
      }
      return originalWriteHead(statusCode, ...args);
    };

    next();
  }, requestId);
}
