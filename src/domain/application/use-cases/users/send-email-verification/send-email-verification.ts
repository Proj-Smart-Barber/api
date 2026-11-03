import { type Either, left, right } from "../../../../../core/logic/either";
import type { EmailVerificationCodesRepository } from "../../../repositories/email-verification-codes-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import {
  createEmailVerificationCode,
  EMAIL_CODE_TTL_MINUTES,
} from "../../../services/email-verification-code-service";
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
    private emailVerificationsRepository: EmailVerificationCodesRepository,
    private emailService: EmailService,
  ) {}

  async execute({
    email,
  }: SendEmailVerificationDTO): Promise<SendEmailVerificationUseCaseResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.usersRepository.findByEmail(normalizedEmail);

    if (!user || user.isEmailVerified) {
      // Keep the response uniform (no account enumeration) and avoid
      // sending verification codes to unknown or already verified accounts.
      return right({ sentTo: normalizedEmail });
    }

    let issued: ReturnType<typeof createEmailVerificationCode> | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = createEmailVerificationCode(user.id.toString());
      const result = await this.emailVerificationsRepository.issue({
        userId: user.id.toString(),
        codeHash: candidate.codeHash,
        expiresAt: candidate.expiresAt,
      });
      if (result === "throttled") return right({ sentTo: normalizedEmail });
      if (result === "issued") {
        issued = candidate;
        break;
      }
    }
    if (!issued) return left(new EmailSendError());

    try {
      await this.emailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        // Legacy template parameters are retained for older mail renderers only.
        verificationUrl: "",
        expiresInHours: 0,
        verificationCode: issued.code,
        expiresInMinutes: EMAIL_CODE_TTL_MINUTES,
      });
    } catch {
      await this.emailVerificationsRepository.revoke(
        user.id.toString(),
        issued.codeHash,
      );
      return left(new EmailSendError());
    }

    return right({ sentTo: normalizedEmail });
  }
}
