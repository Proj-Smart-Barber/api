import type { Controller } from "../../../core/infra/controller";
import { RemoveUserAvatarUseCase } from "../../../domain/application/use-cases/media/remove-user-avatar/remove-user-avatar";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { RemoveUserAvatarController } from "../controllers/users/remove-user-avatar-controller";

export function makeRemoveUserAvatarController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const useCase = new RemoveUserAvatarUseCase(usersRepository);

  return new RemoveUserAvatarController(useCase);
}
