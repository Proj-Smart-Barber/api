import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { Booking } from "../../../../enterprise/entities/booking";
import { BookingNotFoundError } from "../../_errors/booking-not-found-error";

interface CancelBookingUseCaseRequest {
  bookingId: string;
}

type CancelBookingUseCaseResponse = Either<
  BookingNotFoundError,
  {
    booking: Booking;
  }
>;

export class CancelBookingUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}

  async execute({
    bookingId,
  }: CancelBookingUseCaseRequest): Promise<CancelBookingUseCaseResponse> {
    const booking = await this.bookingsRepository.findById(bookingId);

    if (!booking) {
      return left(new BookingNotFoundError());
    }

    await this.bookingsRepository.save(booking);

    return right({
      booking,
    });
  }
}
