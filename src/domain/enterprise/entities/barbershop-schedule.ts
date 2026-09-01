import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";

interface BarbershopScheduleProps {
  barbershopId: UniqueEntityId;
  createdBy: UniqueEntityId;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  createdAt?: Date;
}

export class BarbershopSchedule extends Entity<BarbershopScheduleProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get createdBy(): UniqueEntityId {
    return this.props.createdBy;
  }

  get dayOfWeek(): string {
    return this.props.dayOfWeek;
  }

  get openTime(): string {
    return this.props.openTime;
  }

  get closeTime(): string {
    return this.props.closeTime;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<BarbershopScheduleProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const barbershopschedule = new BarbershopSchedule(
      {
        ...props,
        createdAt: new Date(),
      },
      id,
    );

    return barbershopschedule;
  }
}
