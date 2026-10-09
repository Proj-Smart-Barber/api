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

type RefreshSessionUseCaseResponse = Either<
  InvalidRefreshTokenError,
  RefreshSessionResponse
>;

export class RefreshSessionUseCase {
  constructor(private refreshTokensRepository: RefreshTokensRepository) {}

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
    const { plainToken, refreshToken } = createRefreshToken(
      userId,
      storedToken.familyId.toString(),
    );

    const newRefreshToken =
      await this.refreshTokensRepository.create(refreshToken);

    storedToken.revoke(newRefreshToken.id);
    await this.refreshTokensRepository.save(storedToken);

    return right({
      access_token: createAccessToken(userId),
      refresh_token: plainToken,
    });
  }
}
