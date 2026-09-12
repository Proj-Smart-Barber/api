import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../index";
import {
  bookings,
  shoppingCarts,
  customers,
  serviceItems,
  services,
} from "../schema";
import type {
  BookingsRepository,
  FindManyByBarbermanAndDateParams,
} from "@/domain/application/repositories/bookings-repository";
import type { Booking } from "@/domain/enterprise/entities/booking";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { BookingDetails } from "@/domain/enterprise/entities/value-objects/booking-details";
import { BookingMapper } from "@/domain/enterprise/mappers/booking-mapper";
import { BookingDetailsMapper } from "@/domain/enterprise/mappers/booking-details-mapper";

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
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

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
}
