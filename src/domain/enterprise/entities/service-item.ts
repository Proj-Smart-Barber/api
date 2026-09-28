import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

interface ServiceItemProps {
  serviceId: UniqueEntityId;
  titleSnapshot?: string;
  priceInCentsSnapshot?: number;
  durationInMinutesSnapshot?: number;
  createdAt?: Date;
}

export class ServiceItem extends Entity<ServiceItemProps> {
  get serviceId(): UniqueEntityId {
    return this.props.serviceId;
  }

  get titleSnapshot(): string | undefined {
    return this.props.titleSnapshot;
  }

  get priceInCentsSnapshot(): number | undefined {
    return this.props.priceInCentsSnapshot;
  }

  get durationInMinutesSnapshot(): number | undefined {
    return this.props.durationInMinutesSnapshot;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<ServiceItemProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const serviceitem = new ServiceItem(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return serviceitem;
  }
}
