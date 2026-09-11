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
    // Extrai a string no formato YYYY-MM-DD da data buscada
    const targetDateString = date.toISOString().split("T")[0];

    return this.items.filter((item) => {
      const isSameBarberman = item.barbermanId.toString() === barbermanId;

      if (!item.createdAt) return false;

      // Extrai a string YYYY-MM-DD do agendamento cadastrado
      const itemDateString = item.createdAt.toISOString().split("T")[0];
      const isSameDate = itemDateString === targetDateString;

      return isSameBarberman && isSameDate;
    });
  }

  async findManyByShoppingCart({
    shoppingCartId,
  }: FindManyByShoppingCartParams): Promise<Booking[]> {
    return this.items.filter(
      (item) => item.shoppingCartId.toString() === shoppingCartId,
    );
  }
}
