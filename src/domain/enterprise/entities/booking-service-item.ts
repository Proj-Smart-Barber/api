import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export interface BookingServiceSnapshot {
  serviceId: string | null;
  title: string;
  priceInCents: number | null;
  durationInMinutes: number | null;
  legacyAggregate: boolean;
}

export interface BookingServiceItemProps {
  bookingId: UniqueEntityId;
  serviceId?: UniqueEntityId | null;
  title: string;
  priceInCents?: number | null;
  durationInMinutes?: number | null;
  legacyAggregate: boolean;
  createdAt?: Date;
}

export class BookingServiceItem extends Entity<BookingServiceItemProps> {
  get bookingId(): UniqueEntityId {
    return this.props.bookingId;
  }

  get serviceId(): UniqueEntityId | null {
    return this.props.serviceId ?? null;
  }

  get title(): string {
    return this.props.title;
  }

  get priceInCents(): number | null {
    return this.props.priceInCents ?? null;
  }

  get durationInMinutes(): number | null {
    return this.props.durationInMinutes ?? null;
  }

  get legacyAggregate(): boolean {
    return this.props.legacyAggregate;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  toSnapshot(): BookingServiceSnapshot {
    return {
      serviceId: this.serviceId ? this.serviceId.toString() : null,
      title: this.title,
      priceInCents: this.priceInCents,
      durationInMinutes: this.durationInMinutes,
      legacyAggregate: this.legacyAggregate,
    };
  }

  static create(
    props: Optional<BookingServiceItemProps, "createdAt" | "legacyAggregate">,
    id?: UniqueEntityId,
  ): BookingServiceItem {
    return new BookingServiceItem(
      {
        ...props,
        serviceId: props.serviceId ?? null,
        priceInCents: props.priceInCents ?? null,
        durationInMinutes: props.durationInMinutes ?? null,
        legacyAggregate: props.legacyAggregate ?? false,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );
  }
}
