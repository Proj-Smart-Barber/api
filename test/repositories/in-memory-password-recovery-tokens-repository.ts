import type { PasswordRecoveryTokensRepository } from "../../src/domain/application/repositories/password-recovery-tokens-repository";
import type { PasswordRecoveryToken } from "../../src/domain/enterprise/entities/password-recovery-token";

export class InMemoryPasswordRecoveryTokensRepository
  implements PasswordRecoveryTokensRepository
{
  private tokens: PasswordRecoveryToken[] = [];

  async create(token: PasswordRecoveryToken): Promise<PasswordRecoveryToken> {
    this.tokens.push(token);

    return token;
  }

  async save(token: PasswordRecoveryToken): Promise<PasswordRecoveryToken> {
    const index = this.tokens.findIndex(
      (item) => item.id.toString() === token.id.toString(),
    );

    if (index >= 0) {
      this.tokens[index] = token;
    }

    return token;
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<PasswordRecoveryToken | null> {
    const token = this.tokens.find((item) => item.tokenHash === tokenHash);

    return token ?? null;
  }

  async invalidateActiveByUserId(userId: string): Promise<void> {
    for (const token of this.tokens) {
      if (token.userId.toString() === userId && !token.isUsed()) {
        token.markAsUsed();
      }
    }
  }

  get items(): PasswordRecoveryToken[] {
    return this.tokens;
  }
}
