import type { Controller } from "../../../core/infra/controller";
import { authGateway } from "../../auth/better-auth-gateway";
import { ChangePasswordUseCase } from "../../../domain/application/use-cases/users/change-password/change-password";
import { ChangePasswordController } from "../controllers/users/change-password.controller";

export function makeChangePasswordController(): Controller {
  const changePasswordUseCase = new ChangePasswordUseCase(authGateway);

  return new ChangePasswordController(changePasswordUseCase);
}
