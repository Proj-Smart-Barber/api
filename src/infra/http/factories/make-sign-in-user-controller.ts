import type { Controller } from "../../../core/infra/controller";
import { authGateway } from "../../auth/better-auth-gateway";
import { SignInUserUseCase } from "../../../domain/application/use-cases/users/sign-in-user/sign-in-user";
import { SignInUserController } from "../controllers/sign-in-user-controller";

export function makeSignInUserController(): Controller {
  const signInUserUseCase = new SignInUserUseCase(authGateway);

  return new SignInUserController(signInUserUseCase);
}
