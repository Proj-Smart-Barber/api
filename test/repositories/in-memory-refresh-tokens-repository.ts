import type { RefreshTokensRepository } from "../../src/domain/application/repositories/refresh-tokens-repository";
import type { RefreshToken } from "../../src/domain/enterprise/entities/refresh-token";

export class InMemoryRefreshTokensRepository
  implements RefreshTokensRepository
{
  public items: RefreshToken[] = [];

  async create(refreshToken: RefreshToken): Promise<RefreshToken> {
    this.items.push(refreshToken);

    return refreshToken;
  }

  async save(refreshToken: RefreshToken): Promise<RefreshToken> {
    const index = this.items.findIndex(
      (item) => item.id.toString() === refreshToken.id.toString(),
    );

    if (index >= 0) {
      this.items[index] = refreshToken;
    }

    return refreshToken;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.items.find((item) => item.tokenHash === tokenHash) ?? null;
  }

  async revokeByFamilyId(familyId: string): Promise<void> {
    for (const item of this.items) {
      if (item.familyId.toString() === familyId && !item.isRevoked()) {
        item.revoke();
      }
    }
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    for (const item of this.items) {
      if (item.userId.toString() === userId && !item.isRevoked()) {
        item.revoke();
      }
    }
  }
}
