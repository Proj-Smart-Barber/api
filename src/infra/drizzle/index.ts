import "dotenv/config";

import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { env } from "../env";
import {
  recordPoolAcquireWait,
  recordSqlExecution,
} from "../observability/request-metrics";

function extractSqlText(queryConfig: unknown): string {
  if (typeof queryConfig === "string") return queryConfig;
  if (
    queryConfig &&
    typeof queryConfig === "object" &&
    "text" in queryConfig &&
    typeof (queryConfig as { text?: unknown }).text === "string"
  ) {
    return (queryConfig as { text: string }).text;
  }
  return "SQL";
}

export function instrumentQueryable<
  T extends { query: (...args: any[]) => any },
>(target: T): T {
  const originalQuery = target.query.bind(target);
  const wrappedQuery = function (...args: any[]) {
    const sqlText = extractSqlText(args[0]);
    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const lastArg = args[args.length - 1];
    if (typeof lastArg === "function") {
      const wrappedCallback = function (this: unknown, ...cbArgs: any[]) {
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        recordSqlExecution(sqlText, Math.max(0, now - startedAt));
        return lastArg.apply(this, cbArgs);
      };
      args[args.length - 1] = wrappedCallback;
      return originalQuery(...args);
    }

    const result = originalQuery(...args);
    if (result && typeof result.then === "function") {
      return result.then(
        (res: unknown) => {
          const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          recordSqlExecution(sqlText, Math.max(0, now - startedAt));
          return res;
        },
        (err: unknown) => {
          const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          recordSqlExecution(sqlText, Math.max(0, now - startedAt));
          throw err;
        },
      );
    }
    return result;
  };
  target.query = wrappedQuery as T["query"];
  return target;
}

export function instrumentPool<
  T extends {
    query: (...args: any[]) => any;
    connect: (...args: any[]) => any;
  },
>(poolInstance: T): T {
  instrumentQueryable(poolInstance);
  const originalConnect = poolInstance.connect.bind(poolInstance);
  poolInstance.connect = (async (...args: any[]) => {
    const acquireStart =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (args.length > 0 && typeof args[0] === "function") {
      const cb = args[0];
      return originalConnect(
        (err: Error | undefined, client: any, done: any) => {
          const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          recordPoolAcquireWait(Math.max(0, now - acquireStart));
          if (client && !client.__sbInstrumented) {
            instrumentQueryable(client);
            client.__sbInstrumented = true;
          }
          return cb(err, client, done);
        },
      );
    }
    const client: any = await originalConnect();
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    recordPoolAcquireWait(Math.max(0, now - acquireStart));
    if (client && !client.__sbInstrumented) {
      instrumentQueryable(client);
      client.__sbInstrumented = true;
    }
    return client;
  }) as T["connect"];
  return poolInstance;
}

const nodeEnv = env.NODE_ENV;
const isServerless = Boolean(process.env.VERCEL);
const defaultPoolMax = nodeEnv === "test" ? 5 : 10;

const poolConfig = {
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX ?? defaultPoolMax,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  lock_timeout: env.DB_LOCK_TIMEOUT_MS,
  idle_in_transaction_session_timeout: env.DB_IDLE_IN_TX_TIMEOUT_MS,
  application_name: isServerless
    ? "smartbarber-api-serverless"
    : "smartbarber-api",
};

export const pool =
  nodeEnv === "production"
    ? instrumentPool(new NeonPool(poolConfig))
    : instrumentPool(new PgPool(poolConfig));

export const db =
  nodeEnv === "production"
    ? drizzleNeon({
        client: pool as NeonPool,
      })
    : drizzlePg({
        client: pool as PgPool,
      });
