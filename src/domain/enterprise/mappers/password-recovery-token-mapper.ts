import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { passwordRecoveryTokens } from "../../../infra/drizzle/schema";
import { PasswordRecoveryToken } from "../entities/password-recovery-token";

type PersistencePasswordRecoveryToken = InferSelectModel<
  typeof passwordRecoveryTokens
>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class PasswordRecoveryTokenMapper {
  static toDomain(raw: PersistencePasswordRecoveryToken) {
    return PasswordRecoveryToken.create(
      {
        userId: new UniqueEntityId(raw.userId),
        tokenHash: raw.tokenHash,
        expiresAt: raw.expiresAt,
        createdAt: raw.createdAt ?? new Date(),
        usedAt: raw.usedAt ?? null,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(passwordRecoveryToken: PasswordRecoveryToken) {
    return {
      id: passwordRecoveryToken.id.toString(),
      userId: passwordRecoveryToken.userId.toString(),
      tokenHash: passwordRecoveryToken.tokenHash,
      expiresAt: passwordRecoveryToken.expiresAt,
      createdAt: passwordRecoveryToken.createdAt ?? new Date(),
      usedAt: passwordRecoveryToken.usedAt ?? null,
    };
  }
}
