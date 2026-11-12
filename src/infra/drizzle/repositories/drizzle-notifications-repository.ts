import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { NotificationsRepository } from "../../../domain/application/repositories/notifications-repository";
import type { Notification } from "../../../domain/enterprise/entities/notification";
import { db } from "../index";
import { DrizzleNotificationMapper } from "../mappers/drizzle-notification-mapper";
import { notifications } from "../schema";

export function decodeNotificationCursor(
  cursor?: string,
): { createdAt: Date | null; id: string } | null {
  if (!cursor || typeof cursor !== "string") return null;
  const trimmed = cursor.trim();
  if (!trimmed) return null;

  if (trimmed.includes("|")) {
    const [rawTs, rawId] = trimmed.split("|");
    const parsedDate = new Date(rawTs);
    if (!Number.isNaN(parsedDate.getTime()) && rawId) {
      return { createdAt: parsedDate, id: rawId };
    }
  }

  return { createdAt: null, id: trimmed };
}

export function encodeNotificationCursor(
  createdAt: Date | null | undefined,
  id: string,
): string {
  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return id;
  }
  return `${createdAt.toISOString()}|${id}`;
}

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
    const rows = items.map((item) => ({
      userId: item.userId,
      eventId: item.eventId ?? null,
      type: item.type,
      title: item.title,
      message: item.message,
      referenceType: item.referenceType ?? null,
      referenceId: item.referenceId ?? null,
      scheduledAt: item.scheduledAt,
      sentAt: item.sentAt ?? new Date(),
    }));
    await client.insert(notifications).values(rows).onConflictDoNothing();
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
    const decoded = decodeNotificationCursor(options.cursor);

    const conditions = [eq(notifications.userId, userId)];

    if (decoded) {
      let cursorDate = decoded.createdAt;
      if (!cursorDate) {
        const [cursorRow] = await client
          .select({ createdAt: notifications.createdAt })
          .from(notifications)
          .where(
            and(
              eq(notifications.id, decoded.id),
              eq(notifications.userId, userId),
            ),
          );
        cursorDate = cursorRow?.createdAt ?? null;
      }

      if (cursorDate) {
        conditions.push(
          or(
            lt(notifications.createdAt, cursorDate),
            and(
              eq(notifications.createdAt, cursorDate),
              lt(notifications.id, decoded.id),
            ),
          )!,
        );
      } else {
        conditions.push(lt(notifications.id, decoded.id));
      }
    }

    const results = await client
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit);

    return results.map(DrizzleNotificationMapper.toDomain);
  }

  async countUnreadByUserId(userId: string, tx?: any): Promise<number> {
    const client = tx ?? db;
    const [row] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      );

    return Number(row?.count ?? 0);
  }
}
