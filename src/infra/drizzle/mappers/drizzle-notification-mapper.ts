import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Notification } from "../../../domain/enterprise/entities/notification";
import type { notifications } from "../schema";

type RawNotification = InferSelectModel<typeof notifications>;
type NotificationInsert = InferInsertModel<typeof notifications>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class DrizzleNotificationMapper {
  static toDomain(raw: RawNotification): Notification {
    return Notification.create(
      {
        userId: new UniqueEntityId(raw.userId),
        type: raw.type,
        title: raw.title,
        message: raw.message,
        referenceType: raw.referenceType ?? null,
        referenceId: raw.referenceId
          ? new UniqueEntityId(raw.referenceId)
          : null,
        scheduledAt: raw.scheduledAt,
        sentAt: raw.sentAt ?? null,
        readAt: raw.readAt ?? null,
        createdAt: raw.createdAt ?? new Date(),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(entity: Notification): NotificationInsert {
    return {
      id: entity.id.toString(),
      userId: entity.userId.toString(),
      type: entity.type,
      title: entity.title,
      message: entity.message,
      referenceType: entity.referenceType ?? null,
      referenceId: entity.referenceId?.toString() ?? null,
      scheduledAt: entity.scheduledAt,
      sentAt: entity.sentAt ?? null,
      readAt: entity.readAt ?? null,
      createdAt: entity.createdAt,
    };
  }
}
