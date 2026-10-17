import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";
import { Slug } from "./value-objects/slug";

export type BarbershopStatus = "ACTIVE" | "INACTIVE";

interface BarbershopProps {
  name: string;
  avatarUrl?: string;
  ownerId: UniqueEntityId;
  slug: Slug;
  cnpj: string;
  location: string;
  timezone: string;
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

  set location(location: string) {
    this.props.location = location;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get status(): BarbershopStatus {
    return this.props.status;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<
      BarbershopProps,
      "createdAt" | "slug" | "cnpj" | "timezone" | "status"
    >,
    id?: UniqueEntityId,
  ) {
    const barbershop = new Barbershop(
      {
        slug: Slug.createFromText(props.name),
        cnpj: "00000000000000",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
        ...props,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return barbershop;
  }
}
