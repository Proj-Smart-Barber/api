/** biome-ignore-all lint/complexity/noStaticOnlyClass: mapper class */
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { BookingDetails } from "../entities/booking-details";

export interface PersistenceBookingDetails {
  booking: {
    id: string;
    barbershopId: string;
    barbermanId: string;
    shoppingCartId: string;
    date: Date;
    startTime: string;
    endTime: string;
    createdAt: Date | null;
  };
  customer: {
    id: string;
    name: string;
    phoneNumber: string;
  };
  service: {
    id: string;
    title: string;
    priceInCents: number;
    durationInMinutes: number;
  };
}

export class BookingDetailsMapper {
  static toDomain(raw: PersistenceBookingDetails): BookingDetails {
    return BookingDetails.create({
      bookingId: new UniqueEntityId(raw.booking.id),
      barbershopId: new UniqueEntityId(raw.booking.barbershopId),
      barbermanId: new UniqueEntityId(raw.booking.barbermanId),
      shoppingCartId: new UniqueEntityId(raw.booking.shoppingCartId),
      customer: {
        id: new UniqueEntityId(raw.customer.id),
        name: raw.customer.name,
        phoneNumber: raw.customer.phoneNumber,
      },
      services: [
        {
          id: new UniqueEntityId(raw.service.id),
          title: raw.service.title,
          priceInCents: raw.service.priceInCents,
          durationInMinutes: raw.service.durationInMinutes,
        },
      ],
      date: raw.booking.date,
      startTime: raw.booking.startTime,
      endTime: raw.booking.endTime,
      createdAt: raw.booking.createdAt ?? undefined,
    });
  }

  static toHTTP(bookingDetails: BookingDetails) {
    return {
      id: bookingDetails.bookingId.toString(),
      barbershopId: bookingDetails.barbershopId.toString(),
      barbermanId: bookingDetails.barbermanId.toString(),
      shoppingCartId: bookingDetails.shoppingCartId.toString(),
      customer: {
        id: bookingDetails.customer.id.toString(),
        name: bookingDetails.customer.name,
        phoneNumber: bookingDetails.customer.phoneNumber,
      },
      services: bookingDetails.services.map((service) => ({
        id: service.id.toString(),
        title: service.title,
        priceInCents: service.priceInCents,
        durationInMinutes: service.durationInMinutes,
      })),
      date: bookingDetails.date,
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      createdAt: bookingDetails.createdAt,
    };
  }
}
