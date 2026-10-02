import type { Controller } from "../../../core/infra/controller";
import { GetUserProfileUseCase } from "../../../domain/application/use-cases/users/get-user-profile/get-user-profile";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { GetUserProfileController } from "../controllers/get-user-profile-controller";

export function makeGetUserProfileController(): Controller {
  const usersRepository = new DrizzleUsersRepository();
  const getUserProfileUseCase = new GetUserProfileUseCase(usersRepository);
  const getUserProfileController = new GetUserProfileController(
    getUserProfileUseCase,
  );

  return getUserProfileController;
}
