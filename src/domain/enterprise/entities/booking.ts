import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";
import type { BookingServiceSnapshot } from "./booking-service-item";

export type { BookingServiceSnapshot };

export interface BookingRecord {
  id: string;
  customerId: string | null;
  barbermanId: string;
  barbershopId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  status: string | null;
  version: number;
  createdByUserId: string | null;
  clientRequestId: string | null;
}

export interface BookingProps {
  barbershopId: UniqueEntityId;
  barbermanId: UniqueEntityId;
  customerId?: UniqueEntityId | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  timezone?: string;
  status?: string | null;
  version?: number;
  createdByUserId?: UniqueEntityId | null;
  clientRequestId?: string | null;

  // Services snapshots and totals
  services?: BookingServiceSnapshot[];
  totalPriceInCents?: number | null;
  totalDurationInMinutes?: number | null;

  // Legacy fields for backward compatibility
  shoppingCartId?: UniqueEntityId | null;
  date: Date;
  startTime: string;
  endTime: string;
  paymentStatus?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Booking extends Entity<BookingProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get barbermanId(): UniqueEntityId {
    return this.props.barbermanId;
  }

  get customerId(): UniqueEntityId | null {
    return this.props.customerId ?? null;
  }

  get shoppingCartId(): UniqueEntityId | null {
    return this.props.shoppingCartId ?? null;
  }

  get startsAt(): Date | null | undefined {
    return this.props.startsAt;
  }

  get endsAt(): Date | null | undefined {
    return this.props.endsAt;
  }

  get timezone(): string {
    return this.props.timezone ?? "America/Sao_Paulo";
  }

  get status(): string | null | undefined {
    return this.props.status;
  }

  get version(): number {
    return this.props.version ?? 1;
  }

  get createdByUserId(): UniqueEntityId | null | undefined {
    return this.props.createdByUserId;
  }

  get clientRequestId(): string | null | undefined {
    return this.props.clientRequestId;
  }

  get services(): BookingServiceSnapshot[] {
    return this.props.services ?? [];
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

  get paymentStatus(): string | null | undefined {
    return this.props.paymentStatus;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  toRecord(): BookingRecord {
    return {
      id: this.id.toString(),
      customerId: this.customerId ? this.customerId.toString() : null,
      barbermanId: this.barbermanId.toString(),
      barbershopId: this.barbershopId.toString(),
      startsAt: this.startsAt ?? null,
      endsAt: this.endsAt ?? null,
      timezone: this.timezone,
      status: this.status ?? null,
      version: this.version,
      createdByUserId: this.createdByUserId
        ? this.createdByUserId.toString()
        : null,
      clientRequestId: this.clientRequestId ?? null,
    };
  }

  static create(
    props: Optional<BookingProps, "createdAt" | "version" | "timezone">,
    id?: UniqueEntityId,
  ): Booking {
    const booking = new Booking(
      {
        ...props,
        timezone: props.timezone ?? "America/Sao_Paulo",
        version: props.version ?? 1,
        services: props.services ?? [],
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return booking;
  }
}
