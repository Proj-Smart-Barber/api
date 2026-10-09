import ms from "ms";
import type { StringValue } from "ms";
import { generateOpaqueToken, hashToken } from "../../../core/crypto/token";
import { env } from "../../../infra/env";

const DEFAULT_TTL_IN_MS = 60 * 60 * 1000;

export interface IssuedPasswordRecoveryToken {
  plainToken: string;
  tokenHash: string;
  expiresAt: Date;
  expiresInHours: number;
}

function resolveTtlInMs(expiresIn?: string): number {
  return (
    ms((expiresIn ?? env.PASSWORD_RECOVERY_TOKEN_EXPIRES_IN) as StringValue) ??
    DEFAULT_TTL_IN_MS
  );
}

export function createPasswordRecoveryToken(
  expiresIn?: string,
): IssuedPasswordRecoveryToken {
  const plainToken = generateOpaqueToken();
  const ttlInMs = resolveTtlInMs(expiresIn);

  return {
    plainToken,
    tokenHash: hashToken(plainToken),
    expiresAt: new Date(Date.now() + ttlInMs),
    expiresInHours: Math.max(1, Math.round(ttlInMs / (60 * 60 * 1000))),
  };
}

export function buildPasswordRecoveryUrl(plainToken: string): string {
  const baseUrl = env.FRONTEND_URL ?? env.APP_URL;
  const url = new URL("/reset-password", baseUrl);

  url.searchParams.set("token", plainToken);

  return url.toString();
}
