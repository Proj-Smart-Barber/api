import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../index";
import { bookings } from "../schema";
import type {
  BookingsRepository,
  FindManyByBarbermanAndDateParams,
} from "@/domain/application/repositories/bookings-repository";
import { Booking } from "@/domain/enterprise/entities/booking";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

export class DrizzleBookingsRepository implements BookingsRepository {
  async findManyByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<Booking[]> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const result = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.barbermanId, barbermanId),
          gte(bookings.createdAt, startOfDay),
          lte(bookings.createdAt, endOfDay),
        ),
      );

    return result.map((row) =>
      Booking.create(
        {
          barbershopId: new UniqueEntityId(row.barbershopId),
          barbermanId: new UniqueEntityId(row.barbermanId),
          shoppingCartId: new UniqueEntityId(row.shoppingCartId),
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          createdAt: row.createdAt ?? undefined,
        },
        new UniqueEntityId(row.id),
      ),
    );
  }

  async create(booking: Booking): Promise<void> {
    await db.insert(bookings).values({
      id: booking.id.toString(),
      barbershopId: booking.barbershopId.toString(),
      barbermanId: booking.barbermanId.toString(),
      shoppingCartId: booking.shoppingCartId.toString(),
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      createdAt: booking.createdAt,
    });
  }

  async save(booking: Booking): Promise<void> {
    await db
      .update(bookings)
      .set({
        barbershopId: booking.barbershopId.toString(),
        barbermanId: booking.barbermanId.toString(),
        shoppingCartId: booking.shoppingCartId.toString(),
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
      })
      .where(eq(bookings.id, booking.id.toString()));
  }

  async findById(id: string): Promise<Booking | null> {
    const [result] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id));

    if (!result) return null;

    return Booking.create(
      {
        barbershopId: new UniqueEntityId(result.barbershopId),
        barbermanId: new UniqueEntityId(result.barbermanId),
        shoppingCartId: new UniqueEntityId(result.shoppingCartId),
        date: result.date,
        startTime: result.startTime,
        endTime: result.endTime,
        createdAt: result.createdAt ?? undefined,
      },
      new UniqueEntityId(result.id),
    );
  }

  async findOverlapping(): Promise<Booking | null> {
    return null;
  }

  async findManyByShoppingCart(): Promise<Booking[]> {
    return [];
  }
}
