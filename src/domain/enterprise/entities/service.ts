import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export interface ServiceProps {
  barbershopId: UniqueEntityId;
  title: string;
  description?: string;
  imageUrl?: string | null;
  isFeatured?: boolean;
  featuredOrder?: number;
  priceInCents: number;
  durationInMinutes: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Service extends Entity<ServiceProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get imageUrl(): string | null | undefined {
    return this.props.imageUrl;
  }

  get isFeatured(): boolean {
    return this.props.isFeatured ?? false;
  }

  get featuredOrder(): number {
    return this.props.featuredOrder ?? 0;
  }

  get priceInCents(): number {
    return this.props.priceInCents;
  }

  get durationInMinutes(): number {
    return this.props.durationInMinutes;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  update(
    props: Partial<
      Pick<
        ServiceProps,
        "title" | "description" | "priceInCents" | "durationInMinutes" | "imageUrl" | "isFeatured" | "featuredOrder"
      >
    >,
  ): void {
    if (props.title !== undefined) {
      this.props.title = props.title;
    }
    if (props.description !== undefined) {
      this.props.description = props.description;
    }
    if (props.priceInCents !== undefined) {
      this.props.priceInCents = props.priceInCents;
    }
    if (props.durationInMinutes !== undefined) {
      this.props.durationInMinutes = props.durationInMinutes;
    }
    if (props.imageUrl !== undefined) {
      this.props.imageUrl = props.imageUrl;
    }
    if (props.isFeatured !== undefined) {
      this.props.isFeatured = props.isFeatured;
    }
    if (props.featuredOrder !== undefined) {
      this.props.featuredOrder = props.featuredOrder;
    }
    this.props.updatedAt = new Date();
  }

  static create(
    props: Optional<ServiceProps, "createdAt" | "isActive">,
    id?: UniqueEntityId,
  ) {
    const service = new Service(
      {
        ...props,
        isActive: props.isActive ?? true,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );

    return service;
  }
}
