import { validateNewPassword } from "../../../../../core/security/password-policy";
import { type Either, left, right } from "../../../../../core/logic/either";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { RefreshTokensRepository } from "../../../repositories/refresh-tokens-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface ChangePasswordDTO {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute({
    userId,
    currentPassword,
    newPassword,
  }: ChangePasswordDTO): Promise<
    Either<
      InvalidCredentialsError | ResourceNotFoundError | Error,
      { passwordUpdatedAt: string }
    >
  > {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError());
    }

    const isValidCurrent = await Password.isValid(
      currentPassword,
      user.password.toString(),
    );

    if (isValidCurrent.isLeft()) {
      return left(new InvalidCredentialsError());
    }

    const policy = validateNewPassword(newPassword);
    if (!policy.valid) {
      return left(new Error(policy.error));
    }

    const hashedNew = await Password.generateHashFromPlainText(newPassword, 12);
    user.changePassword(hashedNew);
    user.incrementCredentialVersion();

    await this.usersRepository.update(user);
    await this.refreshTokensRepository.revokeAllByUserId(userId);

    return right({
      passwordUpdatedAt: new Date().toISOString(),
    });
  }
}
