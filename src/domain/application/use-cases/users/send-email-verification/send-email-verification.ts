import { type Either, left, right } from "../../../../../core/logic/either";
import { EmailVerification } from "../../../../enterprise/entities/email-verification";
import type { EmailVerificationsRepository } from "../../../repositories/email-verifications-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import {
  buildEmailVerificationUrl,
  createEmailVerificationToken,
} from "../../../services/email-verification-token-service";
import type { EmailService } from "../../../services/email-service";
import { EmailSendError } from "../../_errors/email-send-error";
import type { SendEmailVerificationDTO } from "./send-email-verification-dto";
import type { SendEmailVerificationResponse } from "./send-email-verification-response";

type SendEmailVerificationUseCaseResponse = Either<
  EmailSendError,
  SendEmailVerificationResponse
>;

export class SendEmailVerificationUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private emailVerificationsRepository: EmailVerificationsRepository,
    private emailService: EmailService,
  ) {}

  async execute({
    email,
  }: SendEmailVerificationDTO): Promise<SendEmailVerificationUseCaseResponse> {
    const user = await this.usersRepository.findByEmail(email);

    if (!user || user.isEmailVerified) {
      // Keep the response uniform (no account enumeration) and avoid
      // sending verification links to unknown or already verified accounts.
      return right({ sentTo: email });
    }

    await this.emailVerificationsRepository.invalidateActiveByUserId(
      user.id.toString(),
    );

    const { plainToken, tokenHash, expiresAt, expiresInHours } =
      createEmailVerificationToken();

    const emailVerification = EmailVerification.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await this.emailVerificationsRepository.create(emailVerification);

    try {
      await this.emailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationUrl: buildEmailVerificationUrl(plainToken),
        expiresInHours,
      });
    } catch {
      return left(new EmailSendError());
    }

    return right({ sentTo: user.email });
  }
}
