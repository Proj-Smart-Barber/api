import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../drizzle/index";

export const LOOKUP_RATE_LIMIT_PER_MINUTE = 30;

export async function checkAndIncrementLookupRateLimit(
  actorId: string,
  shopId: string,
  limit = LOOKUP_RATE_LIMIT_PER_MINUTE,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const keys = [
    `lookup:actor:${actorId}`,
    `lookup:actor_unit:${actorId}:${shopId}`,
  ];

  let maxRetryAfter = 0;
  let isRateLimited = false;

  for (const key of keys) {
    const result = await db.execute<{ count: number; reset_at: Date }>(sql`
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

    const row = (result.rows ? result.rows[0] : (result as any)[0]) as
      | { count: number; reset_at: string | Date }
      | undefined;

    if (row) {
      const currentCount = Number(row.count);
      const resetAt = new Date(row.reset_at);
      const now = new Date();
      const retryAfter = Math.max(
        1,
        Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
      );

      if (currentCount > limit) {
        isRateLimited = true;
        if (retryAfter > maxRetryAfter) {
          maxRetryAfter = retryAfter;
        }
      }
    }
  }

  if (isRateLimited) {
    return { allowed: false, retryAfterSeconds: maxRetryAfter };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function bookingCustomerLookupLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("Cache-Control", "no-store");

  const actorId = req.user?.sub;
  const rawShopId = req.params.shopId;
  const shopId = Array.isArray(rawShopId) ? rawShopId[0] : rawShopId;

  if (!actorId || !shopId) {
    return next();
  }

  try {
    const { allowed, retryAfterSeconds } =
      await checkAndIncrementLookupRateLimit(actorId, shopId);

    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        code: "TOO_MANY_REQUESTS",
        message:
          "Limite de consultas de clientes excedido. Tente novamente mais tarde.",
        retryAfter: retryAfterSeconds,
      });
    }

    return next();
  } catch (error) {
    console.error(
      "[CustomerLookupLimit] Database counter failure:",
      error instanceof Error ? error.message : error,
    );
    return res.status(503).json({
      code: "SERVICE_UNAVAILABLE",
      message: "Serviço de verificação temporariamente indisponível.",
    });
  }
}
