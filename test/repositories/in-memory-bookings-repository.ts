import type {
  BookingsRepository,
  CreateBookingBundleParams,
  CreateBookingWithItemsParams,
  FindManyByBarbermanAndDateParams,
  FindManyByShoppingCartParams,
  FindOverlappingParams,
} from "../../src/domain/application/repositories/bookings-repository";
import type { Booking } from "../../src/domain/enterprise/entities/booking";
import type { BookingServiceItem } from "../../src/domain/enterprise/entities/booking-service-item";
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
  public bookingItems: Map<string, BookingServiceItem[]> = new Map();

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

  async createWithItems({
    booking,
    items,
  }: CreateBookingWithItemsParams): Promise<void> {
    this.items.push(booking);
    this.bookingItems.set(booking.id.toString(), items);
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
      .filter(
        (booking) => booking.shoppingCartId?.toString() === shoppingCartId,
      )
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

    const result: BookingDetails[] = [];
    for (const booking of bookings) {
      const details = await this.getDetails(booking.id.toString());
      if (details) {
        result.push(details);
      }
    }
    return result;
  }

  async findManyByCustomerId(
    customerId: string,
    _options?: { page?: number },
  ): Promise<BookingDetails[]> {
    const customerBookings = this.items.filter((b) => {
      if (b.customerId?.toString() === customerId) return true;
      const bundle = this.createdBundles.find(
        (cb) => cb.booking.id.toString() === b.id.toString(),
      );
      return bundle?.cart.userId.toString() === customerId;
    });

    const result: BookingDetails[] = [];
    for (const booking of customerBookings) {
      const details = await this.getDetails(booking.id.toString());
      if (details) {
        result.push(details);
      }
    }
    return result;
  }

  async getDetails(bookingId: string): Promise<BookingDetails | null> {
    const booking = this.items.find((b) => b.id.toString() === bookingId);
    if (!booking) return null;

    const items = this.bookingItems.get(bookingId);
    if (items && items.length > 0) {
      return BookingDetails.create({
        bookingId: booking.id,
        barbershopId: booking.barbershopId,
        barbermanId: booking.barbermanId,
        customerId: booking.customerId ?? new UniqueEntityId("customer-1"),
        shoppingCartId: booking.shoppingCartId,
        customer: {
          id: booking.customerId ?? new UniqueEntityId("customer-1"),
          name: "John Doe",
          phoneNumber: "(11) 99999-9999",
        },
        services: items.map((item) => ({
          id: item.serviceId ? item.serviceId : undefined,
          serviceId: item.serviceId ? item.serviceId.toString() : null,
          title: item.title,
          priceInCents: item.priceInCents,
          durationInMinutes: item.durationInMinutes,
          legacyAggregate: item.legacyAggregate,
        })),
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        timezone: booking.timezone,
        status: booking.status,
        version: booking.version,
        createdByUserId: booking.createdByUserId,
        clientRequestId: booking.clientRequestId,
        totalPriceInCents: booking.totalPriceInCents,
        totalDurationInMinutes: booking.totalDurationInMinutes,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        createdAt: booking.createdAt,
      });
    }

    const bundle = this.createdBundles.find(
      (b) => b.booking.id.toString() === bookingId,
    );

    const isAggregate = (bundle?.serviceItem.titleSnapshot ?? "").includes(
      " + ",
    );

    return BookingDetails.create({
      bookingId: booking.id,
      barbershopId: booking.barbershopId,
      barbermanId: booking.barbermanId,
      customerId:
        bundle?.cart.userId ??
        booking.customerId ??
        new UniqueEntityId("customer-1"),
      shoppingCartId: booking.shoppingCartId,
      customer: {
        id:
          bundle?.cart.userId ??
          booking.customerId ??
          new UniqueEntityId("customer-1"),
        name: "John Doe",
        phoneNumber: "(11) 99999-9999",
      },
      services: [
        {
          id: isAggregate
            ? undefined
            : (bundle?.serviceItem.serviceId ??
              new UniqueEntityId("service-1")),
          serviceId: isAggregate
            ? null
            : bundle?.serviceItem.serviceId
              ? bundle.serviceItem.serviceId.toString()
              : "service-1",
          title: bundle?.serviceItem.titleSnapshot ?? "Corte de Cabelo",
          priceInCents: bundle?.serviceItem.priceInCentsSnapshot ?? 5000,
          durationInMinutes:
            bundle?.serviceItem.durationInMinutesSnapshot ?? 30,
          legacyAggregate: isAggregate,
        },
      ],
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      timezone: booking.timezone,
      status: booking.status,
      version: booking.version,
      createdByUserId: booking.createdByUserId,
      clientRequestId: booking.clientRequestId,
      totalPriceInCents: booking.totalPriceInCents,
      totalDurationInMinutes: booking.totalDurationInMinutes,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      createdAt: booking.createdAt,
    });
  }

  async findByIdWithDetails(bookingId: string): Promise<BookingDetails | null> {
    return this.getDetails(bookingId);
  }

  async delete(booking: Booking): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === booking.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items.splice(itemIndex, 1);
    }
    this.bookingItems.delete(booking.id.toString());
  }
}
