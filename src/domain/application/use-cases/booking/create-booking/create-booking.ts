import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { type Either, left, right } from "../../../../../core/logic/either";
import { Booking } from "../../../../enterprise/entities/booking";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { ShoppingCartsRepository } from "../../../repositories/shopping-carts-repository";
import { BookingConflictError } from "../../_errors/booking-conflict-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { CreateBookingDTO } from "./create-booking-dto";
import type { CreateBookingResponse } from "./create-booking-response";

type CreateBookingUseCaseResponse = Either<Error, CreateBookingResponse>;

export class CreateBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private shoppingCartsRepository: ShoppingCartsRepository,
  ) {}

  async execute({
    customerId,
    barbermanId,
    shoppingCartId,
    date,
    startTime,
    endTime,
  }: CreateBookingDTO): Promise<CreateBookingUseCaseResponse> {
    const cartWithBarbershop =
      await this.shoppingCartsRepository.findByIdWithBarbershop(shoppingCartId);

    if (!cartWithBarbershop) {
      return left(
        new ResourceNotFoundError("Carrinho de compras não encontrado."),
      );
    }

    if (cartWithBarbershop.cart.userId.toString() !== customerId) {
      return left(
        new NotAllowedError(
          "Este carrinho não pertence ao usuário autenticado.",
        ),
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

    const barbershopId = cartWithBarbershop.barbershopId;

    const overlappingBooking = await this.bookingsRepository.findOverlapping({
      barbermanId,
      barbershopId,
      startAt,
      endAt,
    });

    if (overlappingBooking) {
      return left(new BookingConflictError());
    }

    const booking = Booking.create({
      barbershopId: new UniqueEntityId(barbershopId),
      barbermanId: new UniqueEntityId(barbermanId),
      shoppingCartId: new UniqueEntityId(shoppingCartId),
      date: bookingDate,
      startTime,
      endTime,
    });

    await this.bookingsRepository.create(booking);

    return right({ booking });
  }
}
