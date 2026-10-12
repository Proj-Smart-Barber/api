import type { BookingServiceItem } from "../../enterprise/entities/booking-service-item";

export interface BookingItemsRepository {
  createMany(items: BookingServiceItem[]): Promise<void>;
  findManyByBookingId(bookingId: string): Promise<BookingServiceItem[]>;
  deleteByBookingId(bookingId: string): Promise<void>;
}
