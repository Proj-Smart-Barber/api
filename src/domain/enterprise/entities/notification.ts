import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";

interface NotificationProps {
  bookingId: UniqueEntityId;
  type: string;
  title: string;
  message: string;
  scheduledAt: Date;
  sentAt: Date;
  readAt: Date;
  createdAt?: Date;
}

export class Notification extends Entity<NotificationProps> {
  get bookingId(): UniqueEntityId {
    return this.props.bookingId;
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

  get scheduledAt(): Date {
    return this.props.scheduledAt;
  }

  get sentAt(): Date {
    return this.props.sentAt;
  }

  get readAt(): Date {
    return this.props.readAt;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<NotificationProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const notification = new Notification(
      {
        ...props,
        createdAt: new Date(),
      },
      id,
    );

    return notification;
  }
}
