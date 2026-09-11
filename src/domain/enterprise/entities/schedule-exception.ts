import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";

export interface ScheduleExceptionProps {
  barbershopId: UniqueEntityId;
  barbermanId?: UniqueEntityId | null;
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  createdAt?: Date;
}

export class ScheduleException extends Entity<ScheduleExceptionProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get barbermanId(): UniqueEntityId | null | undefined {
    return this.props.barbermanId;
  }

  get date(): Date {
    return this.props.date;
  }

  get startTime(): string | null | undefined {
    return this.props.startTime;
  }

  get endTime(): string | null | undefined {
    return this.props.endTime;
  }

  get reason(): string | null | undefined {
    return this.props.reason;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<ScheduleExceptionProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const scheduleException = new ScheduleException(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return scheduleException;
  }
}
