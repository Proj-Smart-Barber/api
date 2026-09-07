import type {
  BookingsRepository,
  FindManyByBarbermanAndDateParams,
  FindManyByShoppingCartParams,
  FindOverlappingParams,
} from "../../src/domain/application/repositories/bookings-repository";
import type { Booking } from "../../src/domain/enterprise/entities/booking";

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
    return booking ?? null;
  }

  async findOverlapping({
    barbermanId,
    excludeBookingId,
  }: FindOverlappingParams): Promise<Booking | null> {
    const overlapping = this.items.find((item) => {
      if (excludeBookingId && item.id.toString() === excludeBookingId) {
        return false;
      }

      const isSameBarberman = item.barbermanId.toString() === barbermanId;
      return isSameBarberman;
    });

    return overlapping ?? null;
  }

  async findManyByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<Booking[]> {
    const bookings = this.items.filter((item) => {
      const isSameBarberman = item.barbermanId.toString() === barbermanId;
      const createdAt = item.createdAt;

      const isSameDate =
        createdAt &&
        createdAt.getFullYear() === date.getFullYear() &&
        createdAt.getMonth() === date.getMonth() &&
        createdAt.getDate() === date.getDate();

      return isSameBarberman && isSameDate;
    });

    return bookings;
  }

  async findManyByShoppingCart({
    shoppingCartId,
  }: FindManyByShoppingCartParams): Promise<Booking[]> {
    return this.items.filter(
      (item) => item.shoppingCartId.toString() === shoppingCartId,
    );
  }
}
