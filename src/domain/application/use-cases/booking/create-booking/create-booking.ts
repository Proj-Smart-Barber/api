import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { Booking } from "../../../../enterprise/entities/booking";
import { BookingConflictError } from "../../_errors/booking-conflict-error";

interface CreateBookingUseCaseRequest {
  barbershopId: string;
  barbermanId: string;
  shoppingCartId: string;
  startAt: Date;
  durationInMinutes: number;
}

type CreateBookingUseCaseResponse = Either<
  BookingConflictError,
  {
    booking: Booking;
  }
>;

export class CreateBookingUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}

  async execute({
    barbershopId,
    barbermanId,
    shoppingCartId,
    startAt,
    durationInMinutes,
  }: CreateBookingUseCaseRequest): Promise<CreateBookingUseCaseResponse> {
    const endAt = new Date(startAt.getTime() + durationInMinutes * 60 * 1000);

    const overLappingBooking = await this.bookingsRepository.findOverlapping({
      barbershopId,
      barbermanId,
      startAt,
      endAt,
    });

    if (overLappingBooking) {
      return left(new BookingConflictError());
    }

    const booking = Booking.create({
      barbershopId: new UniqueEntityId(barbershopId),
      barbermanId: new UniqueEntityId(barbermanId),
      shoppingCartId: new UniqueEntityId(shoppingCartId),
    });

    await this.bookingsRepository.create(booking);

    return right({
      booking,
    });
  }
}
