import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { type Either, left, right } from "../../../../../core/logic/either";
import { Booking } from "../../../../enterprise/entities/booking";
import { ServiceItem } from "../../../../enterprise/entities/service-item";
import { ShoppingCart } from "../../../../enterprise/entities/shopping-cart";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import { BookingConflictError } from "../../_errors/booking-conflict-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { CreateBookingDTO } from "./create-booking-dto";
import type { CreateBookingResponse } from "./create-booking-response";

type CreateBookingUseCaseResponse = Either<Error, CreateBookingResponse>;

export class CreateBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    customerId,
    barbermanId,
    serviceId,
    date,
    startTime,
    endTime,
  }: CreateBookingDTO): Promise<CreateBookingUseCaseResponse> {
    const service = await this.servicesRepository.findById(serviceId);

    if (!service || !service.isActive) {
      return left(
        new ResourceNotFoundError("Serviço não encontrado ou inativo."),
      );
    }

    if (startTime >= endTime) {
      return left(
        new Error("O horário de fim deve ser maior que o horário de início."),
      );
    }

    const bookingDate = new Date(`${date}T00:00:00.000Z`);
    const startAt = new Date(`${date}T${startTime}:00.000Z`);
    const endAt = new Date(`${date}T${endTime}:00.000Z`);

    if (
      Number.isNaN(bookingDate.getTime()) ||
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime())
    ) {
      return left(new Error("Data ou horários inválidos."));
    }

    const barbershopId = service.barbershopId.toString();

    const overlappingBooking = await this.bookingsRepository.findOverlapping({
      barbermanId,
      barbershopId,
      startAt,
      endAt,
    });

    if (overlappingBooking) {
      return left(new BookingConflictError());
    }

    const serviceItem = ServiceItem.create({
      serviceId: new UniqueEntityId(serviceId),
      titleSnapshot: service.title,
      priceInCentsSnapshot: service.priceInCents,
      durationInMinutesSnapshot: service.durationInMinutes,
    });

    const cart = ShoppingCart.create({
      serviceItemId: serviceItem.id,
      userId: new UniqueEntityId(customerId),
      totalPriceInCents: service.priceInCents,
    });

    const booking = Booking.create({
      barbershopId: new UniqueEntityId(barbershopId),
      barbermanId: new UniqueEntityId(barbermanId),
      shoppingCartId: cart.id,
      date: bookingDate,
      startTime,
      endTime,
    });

    await this.bookingsRepository.createWithItemAndCart({
      booking,
      serviceItem,
      cart,
    });

    return right({ booking });
  }
}
