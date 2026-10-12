import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { BookingServiceSnapshot } from "./booking-service-item";

export interface BookingDetailsServiceItem extends BookingServiceSnapshot {
  id?: UniqueEntityId;
}

export interface BookingDetailsProps {
  bookingId: UniqueEntityId;
  barbershopId: UniqueEntityId;
  barbermanId: UniqueEntityId;
  customerId?: UniqueEntityId;
  shoppingCartId?: UniqueEntityId | null;
  customer: {
    id: UniqueEntityId;
    name: string;
    phoneNumber: string;
  };
  services: BookingDetailsServiceItem[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  timezone?: string;
  status?: string | null;
  version?: number;
  createdByUserId?: UniqueEntityId | null;
  clientRequestId?: string | null;
  totalPriceInCents?: number | null;
  totalDurationInMinutes?: number | null;
  date: Date;
  startTime: string;
  endTime: string;
  createdAt?: Date;
}

export class BookingDetails {
  private props: BookingDetailsProps;

  get bookingId(): UniqueEntityId {
    return this.props.bookingId;
  }

  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get barbermanId(): UniqueEntityId {
    return this.props.barbermanId;
  }

  get customerId(): UniqueEntityId {
    return this.props.customerId ?? this.props.customer.id;
  }

  get shoppingCartId(): UniqueEntityId | null {
    return this.props.shoppingCartId ?? null;
  }

  get customer() {
    return this.props.customer;
  }

  get services(): BookingDetailsServiceItem[] {
    return this.props.services;
  }

  get startsAt(): Date | null {
    return this.props.startsAt ?? null;
  }

  get endsAt(): Date | null {
    return this.props.endsAt ?? null;
  }

  get timezone(): string {
    return this.props.timezone ?? "America/Sao_Paulo";
  }

  get status(): string | null {
    return this.props.status ?? null;
  }

  get version(): number {
    return this.props.version ?? 1;
  }

  get createdByUserId(): UniqueEntityId | null {
    return this.props.createdByUserId ?? null;
  }

  get clientRequestId(): string | null {
    return this.props.clientRequestId ?? null;
  }

  get totalPriceInCents(): number | null {
    if (this.props.services && this.props.services.length > 0) {
      const hasUnknownPrice = this.props.services.some(
        (s) => s.priceInCents === null,
      );
      if (
        hasUnknownPrice &&
        (this.props.totalPriceInCents === undefined ||
          this.props.totalPriceInCents === null)
      ) {
        return null;
      }
      return this.props.services.reduce(
        (acc, s) => acc + (s.priceInCents ?? 0),
        0,
      );
    }
    return this.props.totalPriceInCents ?? null;
  }

  get totalDurationInMinutes(): number | null {
    if (this.props.services && this.props.services.length > 0) {
      const hasUnknownDuration = this.props.services.some(
        (s) => s.durationInMinutes === null,
      );
      if (
        hasUnknownDuration &&
        (this.props.totalDurationInMinutes === undefined ||
          this.props.totalDurationInMinutes === null)
      ) {
        return null;
      }
      return this.props.services.reduce(
        (acc, s) => acc + (s.durationInMinutes ?? 0),
        0,
      );
    }
    return this.props.totalDurationInMinutes ?? null;
  }

  get date(): Date {
    return this.props.date;
  }

  get startTime(): string {
    return this.props.startTime;
  }

  get endTime(): string {
    return this.props.endTime;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  private constructor(props: BookingDetailsProps) {
    this.props = props;
  }

  static create(props: BookingDetailsProps) {
    return new BookingDetails(props);
  }
}
