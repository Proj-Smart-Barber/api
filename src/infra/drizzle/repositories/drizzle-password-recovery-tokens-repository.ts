import { and, eq, isNull } from "drizzle-orm";
import type { PasswordRecoveryTokensRepository } from "../../../domain/application/repositories/password-recovery-tokens-repository";
import type { PasswordRecoveryToken } from "../../../domain/enterprise/entities/password-recovery-token";
import { PasswordRecoveryTokenMapper } from "../../../domain/enterprise/mappers/password-recovery-token-mapper";
import { db } from "..";
import { passwordRecoveryTokens } from "../schema";

export class DrizzlePasswordRecoveryTokensRepository
  implements PasswordRecoveryTokensRepository
{
  async create(token: PasswordRecoveryToken): Promise<PasswordRecoveryToken> {
    const [createdToken] = await db
      .insert(passwordRecoveryTokens)
      .values(PasswordRecoveryTokenMapper.toPersistence(token))
      .returning();

    return PasswordRecoveryTokenMapper.toDomain(createdToken);
  }

  async save(token: PasswordRecoveryToken): Promise<PasswordRecoveryToken> {
    const [updatedToken] = await db
      .update(passwordRecoveryTokens)
      .set(PasswordRecoveryTokenMapper.toPersistence(token))
      .where(eq(passwordRecoveryTokens.id, token.id.toString()))
      .returning();

    return PasswordRecoveryTokenMapper.toDomain(updatedToken);
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<PasswordRecoveryToken | null> {
    const [token] = await db
      .select()
      .from(passwordRecoveryTokens)
      .where(eq(passwordRecoveryTokens.tokenHash, tokenHash));

    if (!token) {
      return null;
    }

    return PasswordRecoveryTokenMapper.toDomain(token);
  }

  async invalidateActiveByUserId(userId: string): Promise<void> {
    await db
      .update(passwordRecoveryTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordRecoveryTokens.userId, userId),
          isNull(passwordRecoveryTokens.usedAt),
        ),
      );
  }
}
