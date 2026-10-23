import type { Controller } from "../../../core/infra/controller";
import { UpdateUserAvatarUseCase } from "../../../domain/application/use-cases/media/update-user-avatar/update-user-avatar";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleMediaRepository } from "../../drizzle/repositories/drizzle-media-repository";
import { UpdateUserAvatarController } from "../controllers/users/update-user-avatar-controller";

export function makeUpdateUserAvatarController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const mediaRepository = new DrizzleMediaRepository();

  const useCase = new UpdateUserAvatarUseCase(usersRepository, mediaRepository);

  return new UpdateUserAvatarController(useCase);
}
