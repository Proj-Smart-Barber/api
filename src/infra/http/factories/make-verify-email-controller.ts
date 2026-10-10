import type { Controller } from "../../../core/infra/controller";
import { VerifyEmailUseCase } from "../../../domain/application/use-cases/users/verify-email/verify-email";
import { DrizzleEmailVerificationsRepository } from "../../drizzle/repositories/drizzle-email-verifications-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { VerifyEmailController } from "../controllers/verify-email-controller";

export function makeVerifyEmailController(): Controller {
  const emailVerificationsRepository =
    new DrizzleEmailVerificationsRepository();
  const usersRepository = new DrizzleUsersRepository();

  const verifyEmailUseCase = new VerifyEmailUseCase(
    emailVerificationsRepository,
    usersRepository,
  );

  return new VerifyEmailController(verifyEmailUseCase);
}
