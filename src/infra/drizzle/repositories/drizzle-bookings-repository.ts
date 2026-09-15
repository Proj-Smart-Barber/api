import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../index";
import {
  bookings,
  shoppingCarts,
  customers,
  serviceItems,
  services,
  notifications,
} from "../schema";
import type {
  BookingsRepository,
  FindManyByBarbermanAndDateParams,
} from "@/domain/application/repositories/bookings-repository";
import type { Booking } from "@/domain/enterprise/entities/booking";
import type { BookingDetails } from "@/domain/enterprise/entities/booking-details";
import { BookingMapper } from "@/domain/enterprise/mappers/booking-mapper";
import { BookingDetailsMapper } from "@/domain/enterprise/mappers/booking-details-mapper";

export class DrizzleBookingsRepository implements BookingsRepository {
  async findManyByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<Booking[]> {
    const dateStr = new Date(date).toISOString().split("T")[0];
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const result = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.barbermanId, barbermanId),
          gte(bookings.date, startOfDay),
          lte(bookings.date, endOfDay),
        ),
      );

    return result.map((row) => BookingMapper.toDomain(row));
  }

  async create(booking: Booking): Promise<void> {
    const data = BookingMapper.toPersistence(booking);
    await db.insert(bookings).values(data);
  }

  async save(booking: Booking): Promise<void> {
    const data = BookingMapper.toPersistence(booking);
    await db
      .update(bookings)
      .set(data)
      .where(eq(bookings.id, booking.id.toString()));
  }

  async findById(id: string): Promise<Booking | null> {
    const [result] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id));

    if (!result) return null;

    return BookingMapper.toDomain(result);
  }

  async findOverlapping(): Promise<Booking | null> {
    return null;
  }

  async findManyByShoppingCart(): Promise<Booking[]> {
    return [];
  }
  async findManyWithDetailsByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<BookingDetails[]> {
    // const startOfDay = new Date(date);
    // startOfDay.setHours(0, 0, 0, 0);

    // const endOfDay = new Date(date);
    // endOfDay.setHours(23, 59, 59, 999);
    const dateStr = new Date(date).toISOString().split("T")[0];
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
    const result = await db
      .select({
        booking: bookings,
        customer: customers,
        service: services,
      })
      .from(bookings)
      .innerJoin(shoppingCarts, eq(bookings.shoppingCartId, shoppingCarts.id))
      .innerJoin(customers, eq(shoppingCarts.customerId, customers.id))
      .innerJoin(serviceItems, eq(shoppingCarts.serviceItemId, serviceItems.id))
      .innerJoin(services, eq(serviceItems.serviceId, services.id))
      .where(
        and(
          eq(bookings.barbermanId, barbermanId),
          gte(bookings.date, startOfDay),
          lte(bookings.date, endOfDay),
        ),
      );

    return result.map((row) => BookingDetailsMapper.toDomain(row));
  }
  async delete(booking: Booking): Promise<void> {
    // await db.delete(bookings).where(eq(bookings.id, booking.id.toString()));
    const bookingId = booking.id.toString();
    await db.transaction(async (tx) => {
      await tx
        .delete(notifications)
        .where(eq(notifications.bookingId, bookingId));
      await tx.delete(bookings).where(eq(bookings.id, bookingId));
    });
  }
}
