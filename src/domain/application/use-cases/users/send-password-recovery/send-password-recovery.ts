import { type Either, left, right } from "../../../../../core/logic/either";
import { PasswordRecoveryToken } from "../../../../enterprise/entities/password-recovery-token";
import type { PasswordRecoveryTokensRepository } from "../../../repositories/password-recovery-tokens-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { EmailService } from "../../../services/email-service";
import {
  buildPasswordRecoveryUrl,
  createPasswordRecoveryToken,
} from "../../../services/password-recovery-token-service";
import { EmailSendError } from "../../_errors/email-send-error";
import type { SendPasswordRecoveryDTO } from "./send-password-recovery-dto";
import type { SendPasswordRecoveryResponse } from "./send-password-recovery-response";

type SendPasswordRecoveryUseCaseResponse = Either<
  EmailSendError,
  SendPasswordRecoveryResponse
>;

export class SendPasswordRecoveryUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private passwordRecoveryTokensRepository: PasswordRecoveryTokensRepository,
    private emailService: EmailService,
  ) {}

  async execute({
    email,
  }: SendPasswordRecoveryDTO): Promise<SendPasswordRecoveryUseCaseResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.usersRepository.findByEmail(normalizedEmail);

    if (!user) {
      // Keep the response uniform (no account enumeration).
      return right({ sentTo: normalizedEmail });
    }

    await this.passwordRecoveryTokensRepository.invalidateActiveByUserId(
      user.id.toString(),
    );

    const { plainToken, tokenHash, expiresAt, expiresInHours } =
      createPasswordRecoveryToken();

    const passwordRecoveryToken = PasswordRecoveryToken.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await this.passwordRecoveryTokensRepository.create(passwordRecoveryToken);

    try {
      await this.emailService.sendPasswordRecoveryEmail({
        to: user.email,
        name: user.name,
        recoveryUrl: buildPasswordRecoveryUrl(plainToken),
        expiresInHours,
      });
    } catch {
      return left(new EmailSendError());
    }

    return right({ sentTo: user.email });
  }
}
