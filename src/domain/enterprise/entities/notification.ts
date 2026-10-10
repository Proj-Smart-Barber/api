import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

interface NotificationProps {
  userId: UniqueEntityId;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: UniqueEntityId | null;
  scheduledAt: Date;
  sentAt?: Date | null;
  readAt?: Date | null;
  createdAt?: Date;
}

export class Notification extends Entity<NotificationProps> {
  get userId(): UniqueEntityId {
    return this.props.userId;
  }

  get type(): string {
    return this.props.type;
  }

  get title(): string {
    return this.props.title;
  }

  get message(): string {
    return this.props.message;
  }

  get referenceType(): string | null | undefined {
    return this.props.referenceType;
  }

  get referenceId(): UniqueEntityId | null | undefined {
    return this.props.referenceId;
  }

  get scheduledAt(): Date {
    return this.props.scheduledAt;
  }

  get sentAt(): Date | null | undefined {
    return this.props.sentAt;
  }

  get readAt(): Date | null | undefined {
    return this.props.readAt;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  markAsRead(at: Date = new Date()): void {
    this.props.readAt = at;
  }

  static create(
    props: Optional<
      NotificationProps,
      "createdAt" | "sentAt" | "readAt" | "referenceType" | "referenceId"
    >,
    id?: UniqueEntityId,
  ) {
    const notification = new Notification(
      {
        ...props,
        referenceType: props.referenceType ?? null,
        referenceId: props.referenceId ?? null,
        sentAt: props.sentAt ?? null,
        readAt: props.readAt ?? null,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return notification;
  }
}
