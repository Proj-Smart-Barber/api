import { desc, eq } from "drizzle-orm";
import type { NotificationsRepository } from "../../../domain/application/repositories/notifications-repository";
import type { Notification } from "../../../domain/enterprise/entities/notification";
import { db } from "../index";
import { DrizzleNotificationMapper } from "../mappers/drizzle-notification-mapper";
import { notifications } from "../schema";

export class DrizzleNotificationsRepository implements NotificationsRepository {
  async create(notification: Notification, tx?: any): Promise<Notification> {
    const client = tx ?? db;
    const [created] = await client
      .insert(notifications)
      .values(DrizzleNotificationMapper.toDrizzle(notification))
      .returning();

    return DrizzleNotificationMapper.toDomain(created);
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

  async save(notification: Notification, tx?: any): Promise<Notification> {
    const client = tx ?? db;
    const [updated] = await client
      .update(notifications)
      .set(DrizzleNotificationMapper.toDrizzle(notification))
      .where(eq(notifications.id, notification.id.toString()))
      .returning();

    return DrizzleNotificationMapper.toDomain(updated);
  }

  async delete(id: string, tx?: any): Promise<void> {
    const client = tx ?? db;
    await client.delete(notifications).where(eq(notifications.id, id));
  }

  async findById(id: string, tx?: any): Promise<Notification | null> {
    const client = tx ?? db;
    const [notification] = await client
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
    options: { limit?: number; cursor?: string } = {},
    tx?: any,
  ): Promise<Notification[]> {
    const client = tx ?? db;
    const limit = options.limit ?? 20;
    const results = await client
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return results.map(DrizzleNotificationMapper.toDomain);
  }

  async countUnreadByUserId(userId: string, tx?: any): Promise<number> {
    const client = tx ?? db;
    const results = await client
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));

    return results.filter((n: any) => !n.readAt).length;
  }
}
