import { desc, eq } from "drizzle-orm";
import type { NotificationsRepository } from "../../../domain/application/repositories/notifications-repository";
import type { Notification } from "../../../domain/enterprise/entities/notification";
import { db } from "../index";
import { DrizzleNotificationMapper } from "../mappers/drizzle-notification-mapper";
import { notifications } from "../schema";

export class DrizzleNotificationsRepository implements NotificationsRepository {
  async create(notification: Notification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(DrizzleNotificationMapper.toDrizzle(notification))
      .returning();

    return DrizzleNotificationMapper.toDomain(created);
  }

  async save(notification: Notification): Promise<Notification> {
    const [updated] = await db
      .update(notifications)
      .set(DrizzleNotificationMapper.toDrizzle(notification))
      .where(eq(notifications.id, notification.id.toString()))
      .returning();

    return DrizzleNotificationMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async findById(id: string): Promise<Notification | null> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));

    if (!notification) {
      return null;
    }

    return DrizzleNotificationMapper.toDomain(notification);
  }

  async findManyByUserId(userId: string): Promise<Notification[]> {
    const results = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    return results.map(DrizzleNotificationMapper.toDomain);
  }
}
