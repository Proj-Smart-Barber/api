import type { Controller } from "../../../core/infra/controller";
import { authGateway } from "../../auth/better-auth-gateway";
import { RequestPasswordResetUseCase } from "../../../domain/application/use-cases/users/request-password-reset/request-password-reset";
import { ConfirmPasswordResetUseCase } from "../../../domain/application/use-cases/users/confirm-password-reset/confirm-password-reset";
import { RequestPasswordResetController } from "../controllers/users/request-password-reset.controller";
import { ConfirmPasswordResetController } from "../controllers/users/confirm-password-reset.controller";

export function makeRequestPasswordResetController(): Controller {
  const useCase = new RequestPasswordResetUseCase(authGateway);

  return new RequestPasswordResetController(useCase);
}

export function makeConfirmPasswordResetController(): Controller {
  const useCase = new ConfirmPasswordResetUseCase(authGateway);

  return new ConfirmPasswordResetController(useCase);
}
