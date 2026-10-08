import type { Controller } from "../../../core/infra/controller";
import { authGateway } from "../../auth/better-auth-gateway";
import { RequestEmailVerificationUseCase } from "../../../domain/application/use-cases/users/request-email-verification/request-email-verification";
import { ConfirmEmailVerificationUseCase } from "../../../domain/application/use-cases/users/confirm-email-verification/confirm-email-verification";
import { RequestEmailVerificationController } from "../controllers/users/request-email-verification.controller";
import { ConfirmEmailVerificationController } from "../controllers/users/confirm-email-verification.controller";

export function makeRequestEmailVerificationController(): Controller {
  const useCase = new RequestEmailVerificationUseCase(authGateway);

  return new RequestEmailVerificationController(useCase);
}

export function makeConfirmEmailVerificationController(): Controller {
  const useCase = new ConfirmEmailVerificationUseCase(authGateway);

  return new ConfirmEmailVerificationController(useCase);
}
