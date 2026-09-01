import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";
import type { Slug } from "./value-objects/slug";

enum BarbershopStatus {
  ACTIVE,
  INACTIVE,
}

interface BarbershopProps {
  name: string;
  avatarUrl?: string;
  ownerId: UniqueEntityId;
  slug: Slug;
  cnpj: string;
  location: string;
  scheduleId: UniqueEntityId;
  status: BarbershopStatus;
  createdAt?: Date;
}

export class Barbershop extends Entity<BarbershopProps> {
  get name(): string {
    return this.props.name;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get ownerId(): UniqueEntityId {
    return this.props.ownerId;
  }

  get slug(): Slug {
    return this.props.slug;
  }

  get cnpj(): string {
    return this.props.cnpj;
  }

  get location(): string {
    return this.props.location;
  }

  get scheduleId(): UniqueEntityId {
    return this.props.scheduleId;
  }

  get status(): BarbershopStatus {
    return this.props.status;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<BarbershopProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const barbershop = new Barbershop(
      {
        ...props,
        createdAt: new Date(),
      },
      id,
    );

    return barbershop;
  }
}
