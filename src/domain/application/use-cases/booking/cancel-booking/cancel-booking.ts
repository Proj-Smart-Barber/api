import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { BookingNotFoundError } from "../../_errors/booking-not-found-error";
import type { CancelBookingDTO } from "./cancel-booking-dto";
import type { CancelBookingResponse } from "./cancel-booking-response";
// interface CancelBookingUseCaseRequest {
//   bookingId: string;
// }

// type CancelBookingUseCaseResponse = Either<
//   BookingNotFoundError,
//   {
//     booking: Booking;
//   }
// >;

type CancelBookingUseCaseResponse = Either<
  BookingNotFoundError,
  CancelBookingResponse
>;

export class CancelBookingUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}

  async execute({
    bookingId,
  }: CancelBookingDTO): Promise<CancelBookingUseCaseResponse> {
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
