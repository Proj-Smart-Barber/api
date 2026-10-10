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
  action: "accept" | "decline" = "accept",
): string {
  const baseUrl = env.FRONTEND_URL ?? env.APP_URL;
  const url = new URL(`/invitations/${action}`, baseUrl);

  url.searchParams.set("token", plainToken);

  return url.toString();
}
