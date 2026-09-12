import type {
  BookingsRepository,
  FindManyByBarbermanAndDateParams,
  FindManyByShoppingCartParams,
  FindOverlappingParams,
} from "@/domain/application/repositories/bookings-repository";
import type { Booking } from "@/domain/enterprise/entities/booking";

export class InMemoryBookingsRepository implements BookingsRepository {
  public items: Booking[] = [];

  async create(booking: Booking): Promise<void> {
    this.items.push(booking);
  }

  async save(booking: Booking): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === booking.id.toString(),
    );
    if (itemIndex >= 0) {
      this.items[itemIndex] = booking;
    }
  }

  async findById(id: string): Promise<Booking | null> {
    const booking = this.items.find((item) => item.id.toString() === id);
    return booking || null;
  }

  async findOverlapping({
    barbermanId,
    barbershopId,
    startAt,
    endAt,
    excludeBookingId,
  }: FindOverlappingParams): Promise<Booking | null> {
    const overlapping = this.items.find((booking) => {
      if (excludeBookingId && booking.id.toString() === excludeBookingId) {
        return false;
      }
      if (
        booking.barbermanId.toString() !== barbermanId ||
        booking.barbershopId.toString() !== barbershopId
      ) {
        return false;
      }

      const bookingStart = new Date(booking.date);
      const [startHour, startMin] = booking.startTime.split(":").map(Number);
      bookingStart.setUTCHours(startHour, startMin, 0, 0);

      const bookingEnd = new Date(booking.date);
      const [endHour, endMin] = booking.endTime.split(":").map(Number);
      bookingEnd.setUTCHours(endHour, endMin, 0, 0);

      return startAt < bookingEnd && endAt > bookingStart;
    });

    return overlapping || null;
  }

  async findManyByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<Booking[]> {
    const targetDateStr = date.toISOString().split("T")[0];

    return this.items.filter((booking) => {
      const bookingDateStr = booking.date.toISOString().split("T")[0];
      return (
        booking.barbermanId.toString() === barbermanId &&
        bookingDateStr === targetDateStr
      );
    });
  }

  async findManyByShoppingCart({
    shoppingCartId,
    page = 1,
  }: FindManyByShoppingCartParams): Promise<Booking[]> {
    return this.items
      .filter((booking) => booking.shoppingCartId.toString() === shoppingCartId)
      .slice((page - 1) * 20, page * 20);
  }
}
