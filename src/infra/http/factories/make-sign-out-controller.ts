import type { Controller } from "../../../core/infra/controller";
import { authGateway } from "../../auth/better-auth-gateway";
import { SignOutUseCase } from "../../../domain/application/use-cases/users/sign-out/sign-out";
import { SignOutController } from "../controllers/users/sign-out.controller";

export function makeSignOutController(): Controller {
  const signOutUseCase = new SignOutUseCase(authGateway);

  return new SignOutController(signOutUseCase, { all: false });
}

export function makeSignOutAllController(): Controller {
  const signOutUseCase = new SignOutUseCase(authGateway);

  return new SignOutController(signOutUseCase, { all: true });
}
