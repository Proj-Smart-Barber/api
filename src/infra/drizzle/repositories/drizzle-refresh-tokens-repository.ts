import { eq } from "drizzle-orm";
import type { RefreshTokensRepository } from "../../../domain/application/repositories/refresh-tokens-repository";
import type { RefreshToken } from "../../../domain/enterprise/entities/refresh-token";
import { RefreshTokenMapper } from "../../../domain/enterprise/mappers/refresh-token-mapper";
import { db } from "..";
import { refreshTokens } from "../schema";

export class DrizzleRefreshTokensRepository implements RefreshTokensRepository {
  async create(refreshToken: RefreshToken): Promise<RefreshToken> {
    const [createdToken] = await db
      .insert(refreshTokens)
      .values(RefreshTokenMapper.toPersistence(refreshToken))
      .returning();

    return RefreshTokenMapper.toDomain(createdToken);
  }

  async save(refreshToken: RefreshToken): Promise<RefreshToken> {
    const [updatedToken] = await db
      .update(refreshTokens)
      .set(RefreshTokenMapper.toPersistence(refreshToken))
      .where(eq(refreshTokens.id, refreshToken.id.toString()))
      .returning();

    return RefreshTokenMapper.toDomain(updatedToken);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const [refreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    if (!refreshToken) {
      return null;
    }

    return RefreshTokenMapper.toDomain(refreshToken);
  }

  async revokeByFamilyId(familyId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.familyId, familyId));
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, userId));
  }
}
