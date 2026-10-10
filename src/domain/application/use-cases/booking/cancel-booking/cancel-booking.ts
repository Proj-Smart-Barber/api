import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import { Notification } from "../../../../enterprise/entities/notification";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
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
    private notificationsRepository: NotificationsRepository,
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

    const recipients = new Set<string>();
    recipients.add(booking.barbermanId.toString());
    if (barbershop?.ownerId) {
      recipients.add(barbershop.ownerId.toString());
    }

    const dateStr = booking.date.toLocaleDateString("pt-BR");
    for (const userId of recipients) {
      await this.notificationsRepository.create(
        Notification.create({
          userId: new UniqueEntityId(userId),
          type: "BOOKING_CANCELLED",
          title: "Agendamento Cancelado",
          message: `O atendimento agendado para ${dateStr} às ${booking.startTime} foi cancelado.`,
          referenceType: "BOOKING",
          referenceId: booking.id,
          scheduledAt: new Date(),
          sentAt: new Date(),
        }),
      );
    }

    await this.bookingsRepository.delete(booking);

    return right({
      booking,
    });
  }
}
