import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { BookingNotFoundError } from "../../_errors/booking-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import type { CancelBookingDTO } from "./cancel-booking-dto";
import type { CancelBookingResponse } from "./cancel-booking-response";

type CancelBookingUseCaseResponse = Either<
  BookingNotFoundError | NotAllowedError,
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
      return left(new BookingNotFoundError());
    }
    if (booking.barbermanId.toString() !== barbermanId) {
      return left(new NotAllowedError());
    }
    await this.bookingsRepository.delete(booking);

    return right({
      booking,
    });
  }
}
