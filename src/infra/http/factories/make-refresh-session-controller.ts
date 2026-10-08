import type { Controller } from "../../../core/infra/controller";
import { authGateway } from "../../auth/better-auth-gateway";
import { RefreshSessionUseCase } from "../../../domain/application/use-cases/users/refresh-session/refresh-session";
import { RefreshSessionController } from "../controllers/users/refresh-session.controller";

export function makeRefreshSessionController(): Controller {
  const refreshSessionUseCase = new RefreshSessionUseCase(authGateway);

  return new RefreshSessionController(refreshSessionUseCase);
}
