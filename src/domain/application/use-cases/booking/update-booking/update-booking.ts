import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import { Notification } from "../../../../enterprise/entities/notification";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import { BookingConflictError } from "../../_errors/booking-conflict-error";
import type { UpdateBookingDTO } from "./update-booking-dto";
import type { UpdateBookingResponse } from "./update-booking-response";

type UpdateBookingUseCaseResponse = Either<
  ResourceNotFoundError | UnauthorizedError | BookingConflictError,
  UpdateBookingResponse
>;

export class UpdateBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private notificationsRepository: NotificationsRepository,
  ) {}

  async execute({
    bookingId,
    barbermanId,
    date,
    startTime,
    endTime,
  }: UpdateBookingDTO): Promise<UpdateBookingUseCaseResponse> {
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

    const targetDate = date ?? booking.date;
    const targetStartTime = startTime ?? booking.startTime;
    const targetEndTime = endTime ?? booking.endTime;

    if (
      date !== undefined ||
      startTime !== undefined ||
      endTime !== undefined
    ) {
      const targetDateStr = targetDate.toISOString().split("T")[0];
      const startAt = new Date(`${targetDateStr}T00:00:00.000Z`);
      const [startHour, startMin] = targetStartTime.split(":").map(Number);
      startAt.setUTCHours(startHour, startMin, 0, 0);

      const endAt = new Date(`${targetDateStr}T00:00:00.000Z`);
      const [endHour, endMin] = targetEndTime.split(":").map(Number);
      endAt.setUTCHours(endHour, endMin, 0, 0);

      const overlappingBooking = await this.bookingsRepository.findOverlapping({
        barbermanId: booking.barbermanId.toString(),
        barbershopId: booking.barbershopId.toString(),
        startAt,
        endAt,
        excludeBookingId: bookingId,
      });

      if (overlappingBooking) {
        return left(new BookingConflictError());
      }
    }

    if (date !== undefined) {
      booking.date = targetDate;
    }
    if (startTime !== undefined) {
      booking.startTime = targetStartTime;
    }
    if (endTime !== undefined) {
      booking.endTime = targetEndTime;
    }

    await this.bookingsRepository.save(booking);

    const recipients = new Set<string>();
    recipients.add(booking.barbermanId.toString());
    if (barbershop?.ownerId) {
      recipients.add(barbershop.ownerId.toString());
    }

    const dateStr = targetDate.toLocaleDateString("pt-BR");
    for (const userId of recipients) {
      await this.notificationsRepository.create(
        Notification.create({
          userId: new UniqueEntityId(userId),
          type: "BOOKING_UPDATED",
          title: "Agendamento Atualizado",
          message: `O atendimento agendado para ${dateStr} foi alterado para ${targetStartTime} - ${targetEndTime}.`,
          referenceType: "BOOKING",
          referenceId: booking.id,
          scheduledAt: new Date(),
          sentAt: new Date(),
        }),
      );
    }

    return right({
      booking,
    });
  }
}
