import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { RefreshTokensRepository } from "../../../repositories/refresh-tokens-repository";
import {
  createAccessToken,
  createRefreshToken,
} from "../../../services/auth-token-service";
import { InvalidRefreshTokenError } from "../../_errors/invalid-refresh-token-error";
import type { RefreshSessionDTO } from "./refresh-session-dto";
import type { RefreshSessionResponse } from "./refresh-session-response";

import type { UsersRepository } from "../../../repositories/users-repository";

type RefreshSessionUseCaseResponse = Either<
  InvalidRefreshTokenError,
  RefreshSessionResponse
>;

export class RefreshSessionUseCase {
  constructor(
    private refreshTokensRepository: RefreshTokensRepository,
    private usersRepository?: UsersRepository,
  ) {}

  async execute({
    refresh_token,
  }: RefreshSessionDTO): Promise<RefreshSessionUseCaseResponse> {
    const storedToken = await this.refreshTokensRepository.findByTokenHash(
      hashToken(refresh_token),
    );

    if (!storedToken) {
      return left(new InvalidRefreshTokenError());
    }

    if (storedToken.isRevoked()) {
      await this.refreshTokensRepository.revokeByFamilyId(
        storedToken.familyId.toString(),
      );

      return left(new InvalidRefreshTokenError());
    }

    if (storedToken.isExpired()) {
      storedToken.revoke();
      await this.refreshTokensRepository.save(storedToken);

      return left(new InvalidRefreshTokenError());
    }

    const userId = storedToken.userId.toString();
    const user = this.usersRepository
      ? await this.usersRepository.findById(userId)
      : null;
    const isAdmin = user?.accountType === "PLATFORM_ADMIN";
    const accessTtlMs = isAdmin ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const sessionTtlMs = isAdmin
      ? 8 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
    const accessExpiresIn = isAdmin ? "5m" : "15m";

    const { plainToken, refreshToken } = createRefreshToken(
      userId,
      storedToken.familyId.toString(),
      sessionTtlMs,
    );

    const newRefreshToken =
      await this.refreshTokensRepository.create(refreshToken);

    storedToken.revoke(newRefreshToken.id);
    await this.refreshTokensRepository.save(storedToken);

    const now = new Date();
    return right({
      access_token: createAccessToken(
        userId,
        user?.credentialVersion,
        accessExpiresIn,
      ),
      refresh_token: plainToken,
      accessExpiresAt: new Date(now.getTime() + accessTtlMs).toISOString(),
      sessionExpiresAt: refreshToken.expiresAt.toISOString(),
      serverTime: now.toISOString(),
    });
  }
}
