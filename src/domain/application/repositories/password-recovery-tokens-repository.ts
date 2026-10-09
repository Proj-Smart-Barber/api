import type { PasswordRecoveryToken } from "../../enterprise/entities/password-recovery-token";

export interface PasswordRecoveryTokensRepository {
  create(token: PasswordRecoveryToken): Promise<PasswordRecoveryToken>;
  save(token: PasswordRecoveryToken): Promise<PasswordRecoveryToken>;
  findByTokenHash(tokenHash: string): Promise<PasswordRecoveryToken | null>;
  invalidateActiveByUserId(userId: string): Promise<void>;
}
