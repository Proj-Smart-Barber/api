import type { Controller } from "../../../core/infra/controller";
import { SendPasswordRecoveryUseCase } from "../../../domain/application/use-cases/users/send-password-recovery/send-password-recovery";
import { DrizzlePasswordRecoveryTokensRepository } from "../../drizzle/repositories/drizzle-password-recovery-tokens-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { ResendEmailService } from "../../email/resend-email-service";
import { SendPasswordRecoveryController } from "../controllers/send-password-recovery-controller";

export function makeSendPasswordRecoveryController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const passwordRecoveryTokensRepository =
    new DrizzlePasswordRecoveryTokensRepository();
  const emailService = new ResendEmailService();

  const sendPasswordRecoveryUseCase = new SendPasswordRecoveryUseCase(
    usersRepository,
    passwordRecoveryTokensRepository,
    emailService,
  );

  return new SendPasswordRecoveryController(sendPasswordRecoveryUseCase);
}
