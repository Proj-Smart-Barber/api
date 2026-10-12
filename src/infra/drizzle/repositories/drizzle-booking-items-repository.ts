import { eq } from "drizzle-orm";
import { db } from "../index";
import { bookingServiceItems } from "../schema";
import type { BookingItemsRepository } from "../../../domain/application/repositories/booking-items-repository";
import { BookingServiceItem } from "../../../domain/enterprise/entities/booking-service-item";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";

export class DrizzleBookingItemsRepository implements BookingItemsRepository {
  async createMany(items: BookingServiceItem[]): Promise<void> {
    if (items.length === 0) return;

    const values = items.map((item) => ({
      id: item.id.toString(),
      bookingId: item.bookingId.toString(),
      serviceId: item.serviceId ? item.serviceId.toString() : null,
      title: item.title,
      priceInCents: item.priceInCents,
      durationInMinutes: item.durationInMinutes,
      legacyAggregate: item.legacyAggregate,
      createdAt: item.createdAt,
    }));

    await db.insert(bookingServiceItems).values(values);
  }

  async findManyByBookingId(bookingId: string): Promise<BookingServiceItem[]> {
    const rows = await db
      .select()
      .from(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, bookingId));

    return rows.map((row) =>
      BookingServiceItem.create(
        {
          bookingId: new UniqueEntityId(row.bookingId),
          serviceId: row.serviceId ? new UniqueEntityId(row.serviceId) : null,
          title: row.title,
          priceInCents: row.priceInCents,
          durationInMinutes: row.durationInMinutes,
          legacyAggregate: row.legacyAggregate,
          createdAt: row.createdAt ?? undefined,
        },
        new UniqueEntityId(row.id),
      ),
    );
  }

  async deleteByBookingId(bookingId: string): Promise<void> {
    await db
      .delete(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, bookingId));
  }
}
