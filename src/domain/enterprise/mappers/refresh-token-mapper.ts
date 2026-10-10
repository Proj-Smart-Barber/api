import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { refreshTokens } from "../../../infra/drizzle/schema";
import { RefreshToken } from "../entities/refresh-token";

type PersistenceRefreshToken = InferSelectModel<typeof refreshTokens>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class RefreshTokenMapper {
  static toDomain(raw: PersistenceRefreshToken) {
    return RefreshToken.create(
      {
        userId: new UniqueEntityId(raw.userId),
        tokenHash: raw.tokenHash,
        familyId: new UniqueEntityId(raw.familyId),
        expiresAt: raw.expiresAt,
        createdAt: raw.createdAt ?? new Date(),
        revokedAt: raw.revokedAt ?? null,
        replacedByTokenId: raw.replacedByTokenId
          ? new UniqueEntityId(raw.replacedByTokenId)
          : null,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(refreshToken: RefreshToken) {
    return {
      id: refreshToken.id.toString(),
      userId: refreshToken.userId.toString(),
      tokenHash: refreshToken.tokenHash,
      familyId: refreshToken.familyId.toString(),
      expiresAt: refreshToken.expiresAt,
      createdAt: refreshToken.createdAt ?? new Date(),
      revokedAt: refreshToken.revokedAt ?? null,
      replacedByTokenId: refreshToken.replacedByTokenId?.toString() ?? null,
    };
  }
}
