import { type Either, left, right } from "../../../../../core/logic/either";
import type { RefreshTokensRepository } from "../../../repositories/refresh-tokens-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export class LogoutAllUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute({
    userId,
  }: {
    userId: string;
  }): Promise<Either<ResourceNotFoundError, void>> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError());
    }

    user.incrementCredentialVersion();
    await this.usersRepository.update(user);
    await this.refreshTokensRepository.revokeAllByUserId(userId);

    return right(undefined);
  }
}
