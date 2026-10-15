import ms from "ms";
import type { StringValue } from "ms";
import { generateOpaqueToken, hashToken } from "../../../core/crypto/token";
import { env } from "../../../infra/env";

const DEFAULT_TTL_IN_MS = 7 * 24 * 60 * 60 * 1000;

export interface IssuedInvitationToken {
  plainToken: string;
  tokenHash: string;
  expiresAt: Date;
  expiresInDays: number;
}

function resolveTtlInMs(expiresIn?: string): number {
  return (
    ms((expiresIn ?? env.INVITATION_EXPIRES_IN) as StringValue) ??
    DEFAULT_TTL_IN_MS
  );
}

export function createInvitationToken(
  expiresIn?: string,
): IssuedInvitationToken {
  const plainToken = generateOpaqueToken();
  const ttlInMs = resolveTtlInMs(expiresIn);

  return {
    plainToken,
    tokenHash: hashToken(plainToken),
    expiresAt: new Date(Date.now() + ttlInMs),
    expiresInDays: Math.max(1, Math.round(ttlInMs / (24 * 60 * 60 * 1000))),
  };
}

export function buildInvitationUrl(
  plainToken: string,
  isExistingUser = false,
): string {
  const rawBaseUrl = env.FRONTEND_URL ?? env.APP_URL;
  const baseUrl = rawBaseUrl.endsWith("/")
    ? rawBaseUrl.slice(0, -1)
    : rawBaseUrl;
  const path = isExistingUser ? "/invitation" : "/activate-barber";
  const url = new URL(`${baseUrl}${path}`);

  url.searchParams.set("token", plainToken);

  return url.toString();
}
