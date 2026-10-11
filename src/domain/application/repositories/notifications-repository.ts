import type { Notification } from "../../enterprise/entities/notification";

export interface NotificationsRepository {
  create(notification: Notification): Promise<Notification>;
  save(notification: Notification): Promise<Notification>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findManyByUserId(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<Notification[]>;
  countUnreadByUserId(userId: string): Promise<number>;
}
