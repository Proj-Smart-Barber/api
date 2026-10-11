/** biome-ignore-all lint/complexity/noStaticOnlyClass: mapper class */
import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { bookings } from "../../../infra/drizzle/schema";
import { Booking } from "../entities/booking";

type PersistenceBooking = InferSelectModel<typeof bookings>;

export class BookingMapper {
  static toDomain(raw: PersistenceBooking): Booking {
    return Booking.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        barbermanId: new UniqueEntityId(raw.barbermanId),
        customerId: raw.customerId ? new UniqueEntityId(raw.customerId) : null,
        shoppingCartId: raw.shoppingCartId
          ? new UniqueEntityId(raw.shoppingCartId)
          : null,
        startsAt: raw.startsAt,
        endsAt: raw.endsAt,
        timezone: raw.timezone,
        status: raw.status,
        version: raw.version,
        createdByUserId: raw.createdByUserId
          ? new UniqueEntityId(raw.createdByUserId)
          : null,
        clientRequestId: raw.clientRequestId,
        totalPriceInCents: raw.totalPriceInCents,
        totalDurationInMinutes: raw.totalDurationInMinutes,
        date: raw.date,
        startTime: raw.startTime,
        endTime: raw.endTime,
        paymentStatus: raw.paymentStatus,
        createdAt: raw.createdAt ?? undefined,
        updatedAt: raw.updatedAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(booking: Booking) {
    return {
      id: booking.id.toString(),
      barbershopId: booking.barbershopId.toString(),
      barbermanId: booking.barbermanId.toString(),
      customerId: booking.customerId ? booking.customerId.toString() : null,
      shoppingCartId: booking.shoppingCartId
        ? booking.shoppingCartId.toString()
        : null,
      startsAt: booking.startsAt ?? null,
      endsAt: booking.endsAt ?? null,
      timezone: booking.timezone,
      status: booking.status ?? null,
      version: booking.version,
      createdByUserId: booking.createdByUserId
        ? booking.createdByUserId.toString()
        : null,
      clientRequestId: booking.clientRequestId ?? null,
      totalPriceInCents: booking.totalPriceInCents ?? null,
      totalDurationInMinutes: booking.totalDurationInMinutes ?? null,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      paymentStatus: booking.paymentStatus ?? null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  static toHTTP(booking: Booking) {
    return {
      id: booking.id.toString(),
      barbershopId: booking.barbershopId.toString(),
      barbermanId: booking.barbermanId.toString(),
      customerId: booking.customerId ? booking.customerId.toString() : null,
      shoppingCartId: booking.shoppingCartId
        ? booking.shoppingCartId.toString()
        : null,
      startsAt: booking.startsAt?.toISOString() ?? null,
      endsAt: booking.endsAt?.toISOString() ?? null,
      timezone: booking.timezone,
      status: booking.status ?? null,
      version: booking.version,
      createdByUserId: booking.createdByUserId
        ? booking.createdByUserId.toString()
        : null,
      clientRequestId: booking.clientRequestId ?? null,
      totalPriceInCents: booking.totalPriceInCents ?? null,
      totalDurationInMinutes: booking.totalDurationInMinutes ?? null,
      services: booking.services,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      paymentStatus: booking.paymentStatus ?? null,
      createdAt: booking.createdAt,
    };
  }
}
