import { hashToken } from "../../../../../core/crypto/token";
import type { RefreshTokensRepository } from "../../../repositories/refresh-tokens-repository";
import type { SignOutDTO } from "./sign-out-dto";

export class SignOutUseCase {
  constructor(private refreshTokensRepository: RefreshTokensRepository) {}

  async execute({ refresh_token }: SignOutDTO): Promise<void> {
    const storedToken = await this.refreshTokensRepository.findByTokenHash(
      hashToken(refresh_token),
    );

    if (!storedToken || storedToken.isRevoked()) {
      return;
    }

    storedToken.revoke();
    await this.refreshTokensRepository.save(storedToken);
  }
}
