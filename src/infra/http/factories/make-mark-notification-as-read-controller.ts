import { MarkNotificationAsReadUseCase } from "../../../domain/application/use-cases/notifications/mark-notification-as-read/mark-notification-as-read";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { MarkNotificationAsReadController } from "../controllers/notifications/mark-notification-as-read.controller";

export function makeMarkNotificationAsReadController(): MarkNotificationAsReadController {
  const notificationsRepository = new DrizzleNotificationsRepository();
  const useCase = new MarkNotificationAsReadUseCase(notificationsRepository);
  return new MarkNotificationAsReadController(useCase);
}
