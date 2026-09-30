import type { Controller } from "../../../core/infra/controller";
import { CreateUserUseCase } from "../../../domain/application/use-cases/users/create-user/create-user";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { CreateUserController } from "../controllers/create-user-controller";

export function makeCreateUserController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const createUserUseCase = new CreateUserUseCase(usersRepository);
  const createUserController = new CreateUserController(createUserUseCase);

  return createUserController;
}
