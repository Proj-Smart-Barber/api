import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { NotifyBookingEventUseCase } from "../../notifications/notify-booking-event/notify-booking-event";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import type { CancelBookingDTO } from "./cancel-booking-dto";
import type { CancelBookingResponse } from "./cancel-booking-response";

type CancelBookingUseCaseResponse = Either<
  ResourceNotFoundError | UnauthorizedError,
  CancelBookingResponse
>;

export class CancelBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private notifyBookingEventUseCase: NotifyBookingEventUseCase,
  ) {}

  async execute({
    bookingId,
    barbermanId,
  }: CancelBookingDTO): Promise<CancelBookingUseCaseResponse> {
    const booking = await this.bookingsRepository.findById(bookingId);

    if (!booking) {
      return left(new ResourceNotFoundError("Reserva não encontrada."));
    }

    const barbershop = await this.barbershopsRepository.findById(
      booking.barbershopId.toString(),
    );

    const isBarberman = booking.barbermanId.toString() === barbermanId;
    const isOwner = barbershop?.ownerId.toString() === barbermanId;

    if (!isBarberman && !isOwner) {
      return left(new UnauthorizedError());
    }

    if (barbershop) {
      await this.notifyBookingEventUseCase.execute({
        booking,
        barbershop,
        eventType: "CANCELLED",
      });
    }

    await this.bookingsRepository.delete(booking);

    return right({
      booking,
    });
  }
}
