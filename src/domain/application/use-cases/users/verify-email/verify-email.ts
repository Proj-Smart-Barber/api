import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { UsersRepository } from "../../../repositories/users-repository";
import { InvalidVerificationTokenError } from "../../_errors/invalid-verification-token-error";
import type { VerifyEmailDTO } from "./verify-email-dto";
import type { VerifyEmailResponse } from "./verify-email-response";
import type { EmailVerificationCodesRepository } from "../../../repositories/email-verification-codes-repository";
import { hashEmailVerificationCode } from "../../../services/email-verification-code-service";

type VerifyEmailUseCaseResponse = Either<
  InvalidVerificationTokenError,
  VerifyEmailResponse
>;

export class VerifyEmailUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private codesRepository: EmailVerificationCodesRepository,
  ) {}

  async execute(input: VerifyEmailDTO): Promise<VerifyEmailUseCaseResponse> {
    if ("code" in input) {
      if (!this.codesRepository || !/^\d{6}$/.test(input.code))
        return left(new InvalidVerificationTokenError());
      const user = await this.usersRepository.findByEmail(
        input.email.trim().toLowerCase(),
      );
      if (!user) return left(new InvalidVerificationTokenError());
      const result = await this.codesRepository.confirm(
        user.id.toString(),
        hashEmailVerificationCode(user.id.toString(), input.code),
      );
      return result ? right(result) : left(new InvalidVerificationTokenError());
    }
    const result = await this.codesRepository.confirmLegacy(
      hashToken(input.token),
    );
    return result ? right(result) : left(new InvalidVerificationTokenError());
  }
}
