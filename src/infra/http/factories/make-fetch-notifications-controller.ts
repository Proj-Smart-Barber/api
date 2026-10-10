import type { Controller } from "../../../core/infra/controller";
import { FetchUserNotificationsUseCase } from "../../../domain/application/use-cases/notifications/fetch-user-notifications/fetch-user-notifications";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { FetchNotificationsController } from "../controllers/notifications/fetch-notifications.controller";

export function makeFetchNotificationsController(): Controller {
  const fetchUserNotificationsUseCase = new FetchUserNotificationsUseCase(
    new DrizzleUsersRepository(),
    new DrizzleNotificationsRepository(),
  );

  return new FetchNotificationsController(fetchUserNotificationsUseCase);
}
