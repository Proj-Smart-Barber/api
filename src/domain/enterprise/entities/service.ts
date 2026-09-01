import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";

interface ServiceProps {
  title: string;
  description?: string;
  priceInCents: number;
  createdAt?: Date;
}

export class Service extends Entity<ServiceProps> {
  get title(): string {
    return this.props.title;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get priceInCents(): number {
    return this.props.priceInCents;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<ServiceProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const service = new Service(
      {
        ...props,
      },
      id,
    );

    return service;
  }
}
