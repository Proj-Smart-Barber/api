import type { Notification } from "../../enterprise/entities/notification";

export interface CreateNotificationTxParams {
  userId: string;
  eventId?: string | null;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
  scheduledAt: Date;
  sentAt?: Date | null;
}

export interface NotificationsRepository {
  create(notification: Notification): Promise<Notification>;
  createMany(notifications: Notification[]): Promise<void>;
  createManyWithTx(
    items: CreateNotificationTxParams[],
    tx?: any,
  ): Promise<void>;
  save(notification: Notification): Promise<Notification>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findManyByUserId(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<Notification[]>;
  countUnreadByUserId(userId: string): Promise<number>;
}
