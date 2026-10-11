import type { Controller } from "../../../core/infra/controller";
import { RefreshSessionUseCase } from "../../../domain/application/use-cases/users/refresh-session/refresh-session";
import { DrizzleRefreshTokensRepository } from "../../drizzle/repositories/drizzle-refresh-tokens-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { RefreshSessionController } from "../controllers/refresh-session-controller";

export function makeRefreshSessionController(): Controller {
  const refreshTokensRepository = new DrizzleRefreshTokensRepository();
  const usersRepository = new DrizzleUsersRepository();
  const refreshSessionUseCase = new RefreshSessionUseCase(
    refreshTokensRepository,
    usersRepository,
  );
  const refreshSessionController = new RefreshSessionController(
    refreshSessionUseCase,
  );

  return refreshSessionController;
}
