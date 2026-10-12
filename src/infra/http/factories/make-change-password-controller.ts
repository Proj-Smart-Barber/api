import type { Controller } from "../../../core/infra/controller";
import { ChangePasswordUseCase } from "../../../domain/application/use-cases/users/change-password/change-password";
import { DrizzleRefreshTokensRepository } from "../../drizzle/repositories/drizzle-refresh-tokens-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { ChangePasswordController } from "../controllers/change-password-controller";

export function makeChangePasswordController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const refreshTokensRepository = new DrizzleRefreshTokensRepository();
  const changePasswordUseCase = new ChangePasswordUseCase(
    usersRepository,
    refreshTokensRepository,
  );
  return new ChangePasswordController(changePasswordUseCase);
}
