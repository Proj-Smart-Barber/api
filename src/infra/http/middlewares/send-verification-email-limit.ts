import type { Request, Response, NextFunction } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../../drizzle/index";
import { z } from "zod";

const emailSchema = z.email().max(254);

export const EMAIL_VERIFICATION_RATE_LIMIT_PER_MINUTE = 3;
export const EMAIL_VERIFICATION_IP_RATE_LIMIT_PER_MINUTE = 30;

export interface DatabaseExecutor {
  execute(query: SQL): PromiseLike<unknown>;
}

export type RateLimitCheckResult =
  | { status: "ALLOWED" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }
  | { status: "INFRASTRUCTURE_ERROR"; error: unknown };

export async function checkAndIncrementEmailVerificationRateLimit(
  email: string,
  ip?: string,
  limit = EMAIL_VERIFICATION_RATE_LIMIT_PER_MINUTE,
  executor: DatabaseExecutor = db,
): Promise<RateLimitCheckResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const keys = [`email_verification:${normalizedEmail}`];

  if (ip && ip.trim()) {
    keys.push(`email_verification:ip:${ip.trim()}`);
  }

  let maxRetryAfter = 0;
  let isRateLimited = false;

  for (const key of keys) {
    try {
      const result = await executor.execute(sql`
        INSERT INTO "customer_lookup_rate_limits" ("id", "key", "count", "reset_at")
        VALUES (gen_random_uuid(), ${key}, 1, now() + interval '1 minute')
        ON CONFLICT ("key") DO UPDATE
        SET count = CASE
              WHEN "customer_lookup_rate_limits"."reset_at" <= now() THEN 1
              ELSE "customer_lookup_rate_limits"."count" + 1
            END,
            reset_at = CASE
              WHEN "customer_lookup_rate_limits"."reset_at" <= now() THEN now() + interval '1 minute'
              ELSE "customer_lookup_rate_limits"."reset_at"
            END
        RETURNING "count", "reset_at";
      `);

      const rows = Array.isArray(result)
        ? result
        : result &&
            typeof result === "object" &&
            "rows" in result &&
            Array.isArray(result.rows)
          ? result.rows
          : undefined;

      const row = rows?.[0];
      if (
        !row ||
        typeof row !== "object" ||
        !("count" in row) ||
        !("reset_at" in row) ||
        (typeof row.reset_at !== "string" && !(row.reset_at instanceof Date))
      ) {
        return {
          status: "INFRASTRUCTURE_ERROR",
          error: new Error("Invalid rate limit result format from storage"),
        };
      }

      const currentCount = Number(row.count);
      const resetAt = new Date(row.reset_at);
      if (
        !Number.isSafeInteger(currentCount) ||
        currentCount < 1 ||
        !Number.isFinite(resetAt.getTime())
      ) {
        return {
          status: "INFRASTRUCTURE_ERROR",
          error: new Error("Invalid limiter storage values"),
        };
      }
      const now = new Date();
      const retryAfter = Math.max(
        1,
        Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
      );

      const keyLimit = key.startsWith("email_verification:ip:")
        ? EMAIL_VERIFICATION_IP_RATE_LIMIT_PER_MINUTE
        : limit;
      if (currentCount > keyLimit) {
        isRateLimited = true;
        if (retryAfter > maxRetryAfter) {
          maxRetryAfter = retryAfter;
        }
      }
    } catch (err) {
      // Toda falha de banco ou infraestrutura é estritamente reportada, impedindo fail-open inseguro
      return { status: "INFRASTRUCTURE_ERROR", error: err };
    }
  }

  if (isRateLimited) {
    return { status: "RATE_LIMITED", retryAfterSeconds: maxRetryAfter };
  }

  return { status: "ALLOWED" };
}

export function createSendEmailVerificationLimit(
  executor: DatabaseExecutor = db,
) {
  return async function sendEmailVerificationLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    res.setHeader("Cache-Control", "no-store");

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    if (!emailSchema.safeParse(email).success) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "validation_error",
        message: "Informe um e-mail válido.",
      });
    }

    const rawIp = req.ip || req.socket?.remoteAddress;
    const clientIp =
      typeof rawIp === "string" && rawIp.trim() ? rawIp.trim() : undefined;

    try {
      const result = await checkAndIncrementEmailVerificationRateLimit(
        email,
        clientIp,
        EMAIL_VERIFICATION_RATE_LIMIT_PER_MINUTE,
        executor,
      );

      if (result.status === "RATE_LIMITED") {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        return res.status(429).json({
          code: "TOO_MANY_REQUESTS",
          error: "too_many_requests",
          message:
            "Muitas tentativas de envio de verificação. Por favor, aguarde antes de tentar novamente.",
          retryAfter: result.retryAfterSeconds,
        });
      }

      if (result.status === "INFRASTRUCTURE_ERROR") {
        // Log estritamente sanitizado sem dados de PII, parâmetros ou segredos de conexão
        console.error(
          "[SendEmailVerificationLimit] Rate limit storage unavailable. Aborting send to protect service.",
        );
        res.setHeader("Retry-After", "60");
        return res.status(503).json({
          code: "SERVICE_UNAVAILABLE",
          error: "service_unavailable",
          message:
            "Serviço de verificação temporariamente indisponível. Tente novamente mais tarde.",
        });
      }

      return next();
    } catch (_error) {
      console.error(
        "[SendEmailVerificationLimit] Unexpected limiter error. Aborting send.",
      );
      res.setHeader("Retry-After", "60");
      return res.status(503).json({
        code: "SERVICE_UNAVAILABLE",
        error: "service_unavailable",
        message:
          "Serviço de verificação temporariamente indisponível. Tente novamente mais tarde.",
      });
    }
  };
}

export function sendEmailVerificationLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return createSendEmailVerificationLimit(db)(req, res, next);
}
