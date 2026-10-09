import { sign } from "jsonwebtoken";
import ms from "ms";
import type { StringValue } from "ms";
import { generateOpaqueToken, hashToken } from "../../../core/crypto/token";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { env } from "../../../infra/env";
import { RefreshToken } from "../../enterprise/entities/refresh-token";

export function createAccessToken(userId: string): string {
  return sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as StringValue,
  });
}

export interface IssuedRefreshToken {
  plainToken: string;
  refreshToken: RefreshToken;
}

export function createRefreshToken(
  userId: string,
  familyId?: string,
): IssuedRefreshToken {
  const plainToken = generateOpaqueToken();
  const ttlInMs =
    ms(env.REFRESH_TOKEN_EXPIRES_IN as StringValue) ?? 30 * 24 * 60 * 60 * 1000;

  const refreshToken = RefreshToken.create({
    userId: new UniqueEntityId(userId),
    tokenHash: hashToken(plainToken),
    familyId: new UniqueEntityId(familyId),
    expiresAt: new Date(Date.now() + ttlInMs),
  });

  return { plainToken, refreshToken };
}
