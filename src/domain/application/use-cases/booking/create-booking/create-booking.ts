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

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export class CreateBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    customerId,
    barbermanId,
    serviceId,
    serviceIds,
    date,
    startTime,
    endTime,
    expectedTotalPriceInCents,
    expectedDurationInMinutes,
  }: CreateBookingDTO): Promise<CreateBookingUseCaseResponse> {
    const rawIds =
      serviceIds && serviceIds.length > 0
        ? serviceIds
        : serviceId
          ? [serviceId]
          : [];
    if (rawIds.length === 0) {
      return left(new ResourceNotFoundError("Nenhum serviço selecionado."));
    }

    const resolvedServices = [];
    for (const id of rawIds) {
      const s = await this.servicesRepository.findById(id);
      if (!s || !s.isActive) {
        return left(
          new ResourceNotFoundError("Serviço não encontrado ou inativo."),
        );
      }
      resolvedServices.push(s);
    }

    const firstShopId = resolvedServices[0].barbershopId.toString();
    const hasDifferentShop = resolvedServices.some(
      (s) => s.barbershopId.toString() !== firstShopId,
    );
    if (hasDifferentShop) {
      return left(
        new Error("Todos os serviços devem pertencer à mesma barbearia."),
      );
    }

    const calculatedTotalPriceInCents = resolvedServices.reduce(
      (acc, s) => acc + s.priceInCents,
      0,
    );
    const calculatedDurationInMinutes = resolvedServices.reduce(
      (acc, s) => acc + s.durationInMinutes,
      0,
    );

    if (
      expectedTotalPriceInCents !== undefined &&
      expectedTotalPriceInCents !== calculatedTotalPriceInCents
    ) {
      return left(
        new BookingConflictError(
          "O valor dos serviços selecionados foi alterado. Revise os valores para confirmar.",
        ),
      );
    }

    if (
      expectedDurationInMinutes !== undefined &&
      expectedDurationInMinutes !== calculatedDurationInMinutes
    ) {
      return left(
        new BookingConflictError(
          "A duração dos serviços selecionados foi alterada. Revise o horário para confirmar.",
        ),
      );
    }

    const resolvedEndTime =
      endTime ?? addMinutesToTime(startTime, calculatedDurationInMinutes);

    if (startTime >= resolvedEndTime) {
      return left(
        new Error("O horário de fim deve ser maior que o horário de início."),
      );
    }

    const bookingDate = new Date(`${date}T00:00:00.000Z`);
    const startAt = new Date(`${date}T${startTime}:00.000Z`);
    const endAt = new Date(`${date}T${resolvedEndTime}:00.000Z`);

    if (
      Number.isNaN(bookingDate.getTime()) ||
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime())
    ) {
      return left(new Error("Data ou horários inválidos."));
    }

    const barbershopId = firstShopId;

    const overlappingBooking = await this.bookingsRepository.findOverlapping({
      barbermanId,
      barbershopId,
      startAt,
      endAt,
    });

    if (overlappingBooking) {
      return left(new BookingConflictError());
    }

    const primaryService = resolvedServices[0];
    const serviceItem = ServiceItem.create({
      serviceId: primaryService.id,
      titleSnapshot: resolvedServices.map((s) => s.title).join(" + "),
      priceInCentsSnapshot: calculatedTotalPriceInCents,
      durationInMinutesSnapshot: calculatedDurationInMinutes,
    });

    const cart = ShoppingCart.create({
      serviceItemId: serviceItem.id,
      userId: new UniqueEntityId(customerId),
      totalPriceInCents: calculatedTotalPriceInCents,
    });

    const booking = Booking.create({
      barbershopId: new UniqueEntityId(barbershopId),
      barbermanId: new UniqueEntityId(barbermanId),
      shoppingCartId: cart.id,
      date: bookingDate,
      startTime,
      endTime: resolvedEndTime,
    });

    await this.bookingsRepository.createWithItemAndCart({
      booking,
      serviceItem,
      cart,
    });

    return right({ booking });
  }
}
