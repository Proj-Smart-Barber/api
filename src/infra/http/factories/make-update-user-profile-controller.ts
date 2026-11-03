import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { UpdateUserProfileUseCase } from "../../../domain/application/use-cases/users/update-user-profile/update-user-profile";
import { UpdateUserProfileController } from "../controllers/users/update-user-profile.controller";

export function makeUpdateUserProfileController(): UpdateUserProfileController {
  const usersRepository = new DrizzleUsersRepository();
  const updateUserProfileUseCase = new UpdateUserProfileUseCase(usersRepository);

  return new UpdateUserProfileController(updateUserProfileUseCase);
}
