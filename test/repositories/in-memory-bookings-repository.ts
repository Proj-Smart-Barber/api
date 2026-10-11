import type {
  BookingsRepository,
  CreateBookingBundleParams,
  FindManyByBarbermanAndDateParams,
  FindManyByShoppingCartParams,
  FindOverlappingParams,
} from "../../src/domain/application/repositories/bookings-repository";
import type { Booking } from "../../src/domain/enterprise/entities/booking";
import type { ServiceItem } from "../../src/domain/enterprise/entities/service-item";
import type { ShoppingCart } from "../../src/domain/enterprise/entities/shopping-cart";
import { BookingDetails } from "../../src/domain/enterprise/entities/booking-details";
import { UniqueEntityId } from "../../src/core/entities/unique-entity-id";

export interface CreatedBookingBundle {
  booking: Booking;
  serviceItem: ServiceItem;
  cart: ShoppingCart;
}

export class InMemoryBookingsRepository implements BookingsRepository {
  public items: Booking[] = [];
  public createdBundles: CreatedBookingBundle[] = [];

  async create(booking: Booking): Promise<void> {
    this.items.push(booking);
  }

  async createWithItemAndCart({
    booking,
    serviceItem,
    cart,
  }: CreateBookingBundleParams): Promise<void> {
    this.items.push(booking);
    this.createdBundles.push({ booking, serviceItem, cart });
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

    return overlapping ?? null;
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

  async findManyWithDetailsByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<BookingDetails[]> {
    const bookings = await this.findManyByBarbermanAndDate({
      barbermanId,
      date,
    });

    return bookings.map((booking) => {
      return BookingDetails.create({
        bookingId: booking.id,
        barbershopId: booking.barbershopId,
        barbermanId: booking.barbermanId,
        shoppingCartId: booking.shoppingCartId,
        customer: {
          id: new UniqueEntityId("customer-1"),
          name: "John Doe",
          phoneNumber: "(11) 99999-9999",
        },
        services: [
          {
            id: new UniqueEntityId("service-1"),
            title: "Corte de Cabelo",
            priceInCents: 5000,
            durationInMinutes: 30,
          },
        ],
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        createdAt: booking.createdAt,
      });
    });
  }

  async findManyByCustomerId(
    customerId: string,
    _options?: { page?: number },
  ): Promise<BookingDetails[]> {
    const carts = this.createdBundles
      .filter((b) => b.cart.userId.toString() === customerId)
      .map((b) => b.booking);

    return carts.map((booking) => {
      const bundle = this.createdBundles.find(
        (b) => b.booking.id.toString() === booking.id.toString(),
      );
      return BookingDetails.create({
        bookingId: booking.id,
        barbershopId: booking.barbershopId,
        barbermanId: booking.barbermanId,
        shoppingCartId: booking.shoppingCartId,
        customer: {
          id: new UniqueEntityId(customerId),
          name: "Cliente Teste",
          phoneNumber: "(11) 99999-9999",
        },
        services: [
          {
            id:
              bundle?.serviceItem.serviceId ?? new UniqueEntityId("service-1"),
            title: bundle?.serviceItem.titleSnapshot ?? "Serviço",
            priceInCents: bundle?.serviceItem.priceInCentsSnapshot ?? 5000,
            durationInMinutes:
              bundle?.serviceItem.durationInMinutesSnapshot ?? 30,
          },
        ],
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        createdAt: booking.createdAt,
      });
    });
  }

  async findByIdWithDetails(bookingId: string): Promise<BookingDetails | null> {
    const booking = this.items.find((b) => b.id.toString() === bookingId);
    if (!booking) return null;

    const bundle = this.createdBundles.find(
      (b) => b.booking.id.toString() === bookingId,
    );

    return BookingDetails.create({
      bookingId: booking.id,
      barbershopId: booking.barbershopId,
      barbermanId: booking.barbermanId,
      shoppingCartId: booking.shoppingCartId,
      customer: {
        id: bundle?.cart.userId ?? new UniqueEntityId("customer-1"),
        name: "Cliente Teste",
        phoneNumber: "(11) 99999-9999",
      },
      services: [
        {
          id: bundle?.serviceItem.serviceId ?? new UniqueEntityId("service-1"),
          title: bundle?.serviceItem.titleSnapshot ?? "Serviço",
          priceInCents: bundle?.serviceItem.priceInCentsSnapshot ?? 5000,
          durationInMinutes:
            bundle?.serviceItem.durationInMinutesSnapshot ?? 30,
        },
      ],
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      createdAt: booking.createdAt,
    });
  }

  async delete(booking: Booking): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === booking.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items.splice(itemIndex, 1);
    }
  }
}
