import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";

interface ServiceItemProps {
  serviceId: UniqueEntityId;
  createdAt?: Date;
}

export class ServiceItem extends Entity<ServiceItemProps> {
  get serviceId(): UniqueEntityId {
    return this.props.serviceId;
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
      },
      id,
    );

    return serviceitem;
  }
}
