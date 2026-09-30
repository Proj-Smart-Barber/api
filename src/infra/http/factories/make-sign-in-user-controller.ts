import type { Controller } from "../../../core/infra/controller";
import { SignInUserUseCase } from "../../../domain/application/use-cases/users/sign-in-user/sign-in-user";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { SignInUserController } from "../controllers/sign-in-user-controller";

export function makeSignInUserController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const signInUserUseCase = new SignInUserUseCase(
    usersRepository,
    barbershopsRepository,
  );
  const signInUserController = new SignInUserController(signInUserUseCase);

  return signInUserController;
}
