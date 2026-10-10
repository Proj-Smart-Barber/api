import type { Controller } from "../../../core/infra/controller";
import { SendEmailVerificationUseCase } from "../../../domain/application/use-cases/users/send-email-verification/send-email-verification";
import { ResendEmailService } from "../../email/resend-email-service";
import { DrizzleEmailVerificationsRepository } from "../../drizzle/repositories/drizzle-email-verifications-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { SendEmailVerificationController } from "../controllers/send-verification-email-controller";

export function makeSendEmailVerificationController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const emailVerificationsRepository =
    new DrizzleEmailVerificationsRepository();
  const emailService = new ResendEmailService();

  const sendEmailVerificationUseCase = new SendEmailVerificationUseCase(
    usersRepository,
    emailVerificationsRepository,
    emailService,
  );

  return new SendEmailVerificationController(sendEmailVerificationUseCase);
}
