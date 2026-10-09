import ms from "ms";
import type { StringValue } from "ms";
import { generateOpaqueToken, hashToken } from "../../../core/crypto/token";
import { env } from "../../../infra/env";

const DEFAULT_TTL_IN_MS = 24 * 60 * 60 * 1000;

export interface IssuedEmailVerificationToken {
  plainToken: string;
  tokenHash: string;
  expiresAt: Date;
  expiresInHours: number;
}

function resolveTtlInMs(expiresIn?: string): number {
  return (
    ms((expiresIn ?? env.VERIFICATION_TOKEN_EXPIRES_IN) as StringValue) ??
    DEFAULT_TTL_IN_MS
  );
}

export function createEmailVerificationToken(
  expiresIn?: string,
): IssuedEmailVerificationToken {
  const plainToken = generateOpaqueToken();
  const ttlInMs = resolveTtlInMs(expiresIn);

  return {
    plainToken,
    tokenHash: hashToken(plainToken),
    expiresAt: new Date(Date.now() + ttlInMs),
    expiresInHours: Math.max(1, Math.round(ttlInMs / (60 * 60 * 1000))),
  };
}

export function buildEmailVerificationUrl(plainToken: string): string {
  const apiUrl = new URL("/api/users/verification-email/confirm", env.APP_URL);

  apiUrl.searchParams.set("token", plainToken);

  return apiUrl.toString();
}
