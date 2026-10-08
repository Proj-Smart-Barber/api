import type { Controller } from "../../../core/infra/controller";
import { authGateway } from "../../auth/better-auth-gateway";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { CreateUserUseCase } from "../../../domain/application/use-cases/users/create-user/create-user";
import { CreateUserController } from "../controllers/create-user-controller";

export function makeCreateUserController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const createUserUseCase = new CreateUserUseCase(usersRepository, authGateway);

  return new CreateUserController(createUserUseCase);
}
