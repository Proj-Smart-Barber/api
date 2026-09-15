import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import type { CancelBookingDTO } from "./cancel-booking-dto";
import type { CancelBookingResponse } from "./cancel-booking-response";

type CancelBookingUseCaseResponse = Either<
  ResourceNotFoundError | UnauthorizedError,
  CancelBookingResponse
>;

export class CancelBookingUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}

  async execute({
    bookingId,
    barbermanId,
  }: CancelBookingDTO): Promise<CancelBookingUseCaseResponse> {
    const booking = await this.bookingsRepository.findById(bookingId);

    if (!booking) {
      return left(new ResourceNotFoundError("Reserva não encontrada."));
    }

    if (booking.barbermanId.toString() !== barbermanId) {
      return left(new UnauthorizedError());
    }

    await this.bookingsRepository.delete(booking);

    return right({
      booking,
    });
  }
}
