import type { Controller } from "../../../core/infra/controller";
import { ResetPasswordUseCase } from "../../../domain/application/use-cases/users/reset-password/reset-password";
import { DrizzlePasswordRecoveryTokensRepository } from "../../drizzle/repositories/drizzle-password-recovery-tokens-repository";
import { DrizzleRefreshTokensRepository } from "../../drizzle/repositories/drizzle-refresh-tokens-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { ResetPasswordController } from "../controllers/reset-password-controller";

export function makeResetPasswordController(): Controller {
  const passwordRecoveryTokensRepository =
    new DrizzlePasswordRecoveryTokensRepository();
  const usersRepository = new DrizzleUsersRepository();
  const refreshTokensRepository = new DrizzleRefreshTokensRepository();

  const resetPasswordUseCase = new ResetPasswordUseCase(
    passwordRecoveryTokensRepository,
    usersRepository,
    refreshTokensRepository,
  );

  return new ResetPasswordController(resetPasswordUseCase);
}
