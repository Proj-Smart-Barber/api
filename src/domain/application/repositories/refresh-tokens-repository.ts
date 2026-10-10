import type { RefreshToken } from "../../enterprise/entities/refresh-token";

export interface RefreshTokensRepository {
  create(refreshToken: RefreshToken): Promise<RefreshToken>;
  save(refreshToken: RefreshToken): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  revokeByFamilyId(familyId: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
}
