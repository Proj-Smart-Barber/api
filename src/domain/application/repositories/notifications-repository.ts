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
  create(notification: Notification, tx?: any): Promise<Notification>;
  createManyWithTx(
    items: CreateNotificationTxParams[],
    tx?: any,
  ): Promise<void>;
  save(notification: Notification, tx?: any): Promise<Notification>;
  delete(id: string, tx?: any): Promise<void>;
  findById(id: string, tx?: any): Promise<Notification | null>;
  findManyByUserId(
    userId: string,
    options?: { limit?: number; cursor?: string },
    tx?: any,
  ): Promise<Notification[]>;
  countUnreadByUserId(userId: string, tx?: any): Promise<number>;
}
