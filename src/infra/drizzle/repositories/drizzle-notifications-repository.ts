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

  async createMany(notificationsList: Notification[]): Promise<void> {
    if (notificationsList.length === 0) {
      return;
    }

    const data = notificationsList.map((notification) =>
      DrizzleNotificationMapper.toDrizzle(notification),
    );

    await db.insert(notifications).values(data);
  }

  async createManyWithTx(
    items: Array<{
      userId: string;
      eventId?: string | null;
      type: string;
      title: string;
      message: string;
      referenceType?: string | null;
      referenceId?: string | null;
      scheduledAt: Date;
      sentAt?: Date | null;
    }>,
    tx?: any,
  ): Promise<void> {
    if (items.length === 0) return;
    const client = tx ?? db;
    for (const item of items) {
      await client
        .insert(notifications)
        .values({
          userId: item.userId,
          eventId: item.eventId ?? null,
          type: item.type,
          title: item.title,
          message: item.message,
          referenceType: item.referenceType ?? null,
          referenceId: item.referenceId ?? null,
          scheduledAt: item.scheduledAt,
          sentAt: item.sentAt ?? new Date(),
        })
        .onConflictDoNothing();
    }
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

  async findManyByUserId(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<Notification[]> {
    const limit = Math.min(options?.limit ?? 20, 100);

    const query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const results = await query;
    return results.map(DrizzleNotificationMapper.toDomain);
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    const results = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));

    return results.filter((n) => !n.readAt).length;
  }
}
