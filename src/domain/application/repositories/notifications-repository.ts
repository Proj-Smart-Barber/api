import type { Notification } from "../../enterprise/entities/notification";

export interface NotificationsRepository {
  create(notification: Notification): Promise<Notification>;
  createMany(notifications: Notification[]): Promise<void>;
  save(notification: Notification): Promise<Notification>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findManyByUserId(userId: string): Promise<Notification[]>;
}
