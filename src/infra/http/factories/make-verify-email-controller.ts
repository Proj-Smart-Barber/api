import type { Controller } from "../../../core/infra/controller";
import { VerifyEmailUseCase } from "../../../domain/application/use-cases/users/verify-email/verify-email";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { VerifyEmailController } from "../controllers/verify-email-controller";
import { DrizzleEmailVerificationCodesRepository } from "../../drizzle/repositories/drizzle-email-verification-codes-repository";

export function makeVerifyEmailController(): Controller {
  const usersRepository = new DrizzleUsersRepository();

  const verifyEmailUseCase = new VerifyEmailUseCase(
    usersRepository,
    new DrizzleEmailVerificationCodesRepository(),
  );

  return new VerifyEmailController(verifyEmailUseCase);
}
