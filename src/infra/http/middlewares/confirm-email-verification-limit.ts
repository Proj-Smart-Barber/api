import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  checkAndIncrementEmailVerificationRateLimit,
  type DatabaseExecutor,
} from "./send-verification-email-limit";
import { db } from "../../drizzle";

export function createConfirmEmailVerificationLimit(
  executor: DatabaseExecutor = db,
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    // Old high-entropy links remain supported. Numeric codes must never be query parameters.
    if (request.method === "GET") {
      if (request.query.email !== undefined || request.query.code !== undefined)
        return response
          .status(405)
          .json({ error: "Use POST para confirmar um código." });
      return next();
    }
    if (
      typeof request.body?.token === "string" &&
      request.body.email === undefined &&
      request.body.code === undefined
    )
      return next();
    const parsed = z
      .object({ email: z.email().max(254), code: z.string().regex(/^\d{6}$/) })
      .safeParse(request.body);
    if (!parsed.success)
      return response
        .status(400)
        .json({ error: "Informe e-mail e código de seis dígitos." });
    const result = await checkAndIncrementEmailVerificationRateLimit(
      "confirm:" + parsed.data.email,
      request.ip ?? request.socket?.remoteAddress,
      10,
      executor,
    );
    if (result.status === "INFRASTRUCTURE_ERROR")
      return response
        .status(503)
        .json({
          code: "SERVICE_UNAVAILABLE",
          error: "Confirmação temporariamente indisponível.",
        });
    if (result.status === "RATE_LIMITED") {
      response.setHeader("Retry-After", String(result.retryAfterSeconds));
      return response
        .status(429)
        .json({
          code: "TOO_MANY_REQUESTS",
          retryAfter: result.retryAfterSeconds,
          error: "Muitas tentativas. Aguarde antes de tentar novamente.",
        });
    }
    return next();
  };
}
export function confirmEmailVerificationLimit(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  return createConfirmEmailVerificationLimit(db)(request, response, next);
}
