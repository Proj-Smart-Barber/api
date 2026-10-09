import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { EmailVerificationsRepository } from "../../../repositories/email-verifications-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { InvalidVerificationTokenError } from "../../_errors/invalid-verification-token-error";
import type { VerifyEmailDTO } from "./verify-email-dto";
import type { VerifyEmailResponse } from "./verify-email-response";

type VerifyEmailUseCaseResponse = Either<
  InvalidVerificationTokenError,
  VerifyEmailResponse
>;

export class VerifyEmailUseCase {
  constructor(
    private emailVerificationsRepository: EmailVerificationsRepository,
    private usersRepository: UsersRepository,
  ) {}

  async execute({
    token,
  }: VerifyEmailDTO): Promise<VerifyEmailUseCaseResponse> {
    const verification =
      await this.emailVerificationsRepository.findByTokenHash(hashToken(token));

    if (!verification) {
      return left(new InvalidVerificationTokenError());
    }

    const user = await this.usersRepository.findById(
      verification.userId.toString(),
    );

    if (!user) {
      return left(new InvalidVerificationTokenError());
    }

    if (user.isEmailVerified) {
      return right({
        userId: user.id.toString(),
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt as Date,
        alreadyVerified: true,
      });
    }

    if (!verification.isValid()) {
      return left(new InvalidVerificationTokenError());
    }

    verification.markAsUsed();
    await this.emailVerificationsRepository.save(verification);

    const emailVerifiedAt = new Date();
    user.verifyEmail(emailVerifiedAt);
    await this.usersRepository.update(user);

    return right({
      userId: user.id.toString(),
      email: user.email,
      emailVerifiedAt,
      alreadyVerified: false,
    });
  }
}
