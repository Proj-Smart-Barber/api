import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";
import { Slug } from "./value-objects/slug";

export type BarbershopStatus = "ACTIVE" | "INACTIVE";

interface BarbershopProps {
  name: string;
  avatarUrl?: string;
  googleMapsUrl?: string;
  coverUrl?: string;
  rating?: number;
  reviewCount?: number;
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

  set avatarUrl(url: string | undefined) {
    this.props.avatarUrl = url;
  }

  get googleMapsUrl(): string | undefined {
    return this.props.googleMapsUrl;
  }

  set googleMapsUrl(url: string | undefined) {
    this.props.googleMapsUrl = url;
  }

  get coverUrl(): string | undefined {
    return this.props.coverUrl;
  }

  set coverUrl(url: string | undefined) {
    this.props.coverUrl = url;
  }

  get rating(): number {
    return this.props.rating ?? 0;
  }

  get reviewCount(): number {
    return this.props.reviewCount ?? 0;
  }

  updateRatingMetrics(rating: number, count: number): void {
    this.props.rating = rating;
    this.props.reviewCount = count;
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
