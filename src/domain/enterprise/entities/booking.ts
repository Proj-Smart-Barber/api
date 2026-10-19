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
  date?: Date;
  startTime?: string;
  endTime?: string;
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
    return this.props.date ?? this.props.startsAt ?? new Date();
  }

  get startTime(): string {
    return (
      this.props.startTime ??
      (this.props.startsAt
        ? this.props.startsAt.toTimeString().slice(0, 5)
        : "00:00")
    );
  }

  get endTime(): string {
    return (
      this.props.endTime ??
      (this.props.endsAt
        ? this.props.endsAt.toTimeString().slice(0, 5)
        : "00:00")
    );
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

  cancel(newVersion: number) {
    this.props.status = "CANCELLED";
    this.props.version = newVersion;
    this.props.updatedAt = new Date();
  }

  reschedule(params: {
    barbermanId?: UniqueEntityId;
    date: Date;
    startTime: string;
    endTime: string;
    startsAt: Date;
    endsAt: Date;
    services?: BookingServiceSnapshot[];
    totalPriceInCents?: number | null;
    totalDurationInMinutes?: number | null;
    newVersion: number;
  }) {
    if (params.barbermanId) this.props.barbermanId = params.barbermanId;
    this.props.date = params.date;
    this.props.startTime = params.startTime;
    this.props.endTime = params.endTime;
    this.props.startsAt = params.startsAt;
    this.props.endsAt = params.endsAt;
    if (params.services) this.props.services = params.services;
    if (params.totalPriceInCents !== undefined)
      this.props.totalPriceInCents = params.totalPriceInCents;
    if (params.totalDurationInMinutes !== undefined)
      this.props.totalDurationInMinutes = params.totalDurationInMinutes;
    this.props.version = params.newVersion;
    this.props.updatedAt = new Date();
  }

  transitionStatus(newStatus: "COMPLETED" | "NO_SHOW", newVersion: number) {
    this.props.status = newStatus;
    this.props.version = newVersion;
    this.props.updatedAt = new Date();
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
    const startsAt = props.startsAt;
    const endsAt = props.endsAt;
    const derivedDate = props.date ?? (startsAt ? startsAt : new Date());
    const derivedStartTime =
      props.startTime ??
      (startsAt ? startsAt.toISOString().substring(11, 16) : "00:00");
    const derivedEndTime =
      props.endTime ??
      (endsAt ? endsAt.toISOString().substring(11, 16) : "00:30");

    const booking = new Booking(
      {
        ...props,
        date: derivedDate,
        startTime: derivedStartTime,
        endTime: derivedEndTime,
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
