import type { Controller } from "../../../core/infra/controller";
import { SignInUserUseCase } from "../../../domain/application/use-cases/users/sign-in-user/sign-in-user";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { SignInUserController } from "../controllers/sign-in-user-controller";

export function makeSignInUserController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const signInUserUseCase = new SignInUserUseCase(usersRepository);
  const signInUserController = new SignInUserController(signInUserUseCase);

  return signInUserController;
}
