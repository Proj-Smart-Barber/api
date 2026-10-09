import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { PasswordRecoveryTokensRepository } from "../../../repositories/password-recovery-tokens-repository";
import type { RefreshTokensRepository } from "../../../repositories/refresh-tokens-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { InvalidPasswordRecoveryTokenError } from "../../_errors/invalid-password-recovery-token-error";
import { WeakPasswordError } from "../../_errors/weak-password-error";
import type { ResetPasswordDTO } from "./reset-password-dto";
import type { ResetPasswordResponse } from "./reset-password-response";

const MIN_PASSWORD_LENGTH = 8;

type ResetPasswordUseCaseResponse = Either<
  InvalidPasswordRecoveryTokenError | WeakPasswordError,
  ResetPasswordResponse
>;

export class ResetPasswordUseCase {
  constructor(
    private passwordRecoveryTokensRepository: PasswordRecoveryTokensRepository,
    private usersRepository: UsersRepository,
    private refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute({
    token,
    newPassword,
  }: ResetPasswordDTO): Promise<ResetPasswordUseCaseResponse> {
    const passwordRecoveryToken =
      await this.passwordRecoveryTokensRepository.findByTokenHash(
        hashToken(token),
      );

    if (!passwordRecoveryToken) {
      return left(new InvalidPasswordRecoveryTokenError());
    }

    const user = await this.usersRepository.findById(
      passwordRecoveryToken.userId.toString(),
    );

    if (!user) {
      return left(new InvalidPasswordRecoveryTokenError());
    }

    if (!passwordRecoveryToken.isValid()) {
      return left(new InvalidPasswordRecoveryTokenError());
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return left(new WeakPasswordError());
    }

    passwordRecoveryToken.markAsUsed();
    await this.passwordRecoveryTokensRepository.save(passwordRecoveryToken);

    const password = await Password.generateHashFromPlainText(newPassword, 12);
    user.changePassword(password);
    await this.usersRepository.update(user);

    await this.passwordRecoveryTokensRepository.invalidateActiveByUserId(
      user.id.toString(),
    );
    await this.refreshTokensRepository.revokeAllByUserId(user.id.toString());

    return right({
      userId: user.id.toString(),
      email: user.email,
      passwordUpdatedAt: new Date(),
    });
  }
}
