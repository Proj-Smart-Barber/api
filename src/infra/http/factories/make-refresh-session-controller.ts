import type { Controller } from "../../../core/infra/controller";
import { RefreshSessionUseCase } from "../../../domain/application/use-cases/users/refresh-session/refresh-session";
import { DrizzleRefreshTokensRepository } from "../../drizzle/repositories/drizzle-refresh-tokens-repository";
import { RefreshSessionController } from "../controllers/refresh-session-controller";

export function makeRefreshSessionController(): Controller {
  const refreshTokensRepository = new DrizzleRefreshTokensRepository();
  const refreshSessionUseCase = new RefreshSessionUseCase(
    refreshTokensRepository,
  );
  const refreshSessionController = new RefreshSessionController(
    refreshSessionUseCase,
  );

  return refreshSessionController;
}
