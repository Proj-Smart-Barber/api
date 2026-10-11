import type { Controller } from "../../../core/infra/controller";
import { LogoutAllUseCase } from "../../../domain/application/use-cases/users/logout-all/logout-all";
import { DrizzleRefreshTokensRepository } from "../../drizzle/repositories/drizzle-refresh-tokens-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { LogoutAllController } from "../controllers/logout-all-controller";

export function makeLogoutAllController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const refreshTokensRepository = new DrizzleRefreshTokensRepository();
  const logoutAllUseCase = new LogoutAllUseCase(
    usersRepository,
    refreshTokensRepository,
  );
  return new LogoutAllController(logoutAllUseCase);
}
