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
        shoppingCartId: new UniqueEntityId(raw.shoppingCartId),
        date: raw.date,
        startTime: raw.startTime,
        endTime: raw.endTime,
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(booking: Booking) {
    return {
      id: booking.id.toString(),
      barbershopId: booking.barbershopId.toString(),
      barbermanId: booking.barbermanId.toString(),
      shoppingCartId: booking.shoppingCartId.toString(),
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      createdAt: booking.createdAt,
    };
  }

  static toHTTP(booking: Booking) {
    return {
      id: booking.id.toString(),
      barbershopId: booking.barbershopId.toString(),
      barbermanId: booking.barbermanId.toString(),
      shoppingCartId: booking.shoppingCartId.toString(),
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      createdAt: booking.createdAt,
    };
  }
}
