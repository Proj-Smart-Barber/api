import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import { Notification } from "../../../../enterprise/entities/notification";
import type { NotifyBookingEventDTO } from "./notify-booking-event-dto";

export class NotifyBookingEventUseCase {
  constructor(private notificationsRepository: NotificationsRepository) {}

  async execute({
    booking,
    barbershop,
    eventType,
    dateText,
    timeText,
  }: NotifyBookingEventDTO): Promise<void> {
    const recipients = new Set<string>();
    recipients.add(booking.barbermanId.toString());
    if (barbershop.ownerId) {
      recipients.add(barbershop.ownerId.toString());
    }

    const formattedDate = dateText ?? booking.date.toLocaleDateString("pt-BR");
    const formattedTime =
      timeText ?? `${booking.startTime} - ${booking.endTime}`;

    const isUpdated = eventType === "UPDATED";
    const title = isUpdated
      ? "Agendamento Atualizado"
      : "Agendamento Cancelado";
    const message = isUpdated
      ? `O atendimento agendado para ${formattedDate} foi alterado para ${formattedTime}.`
      : `O atendimento agendado para ${formattedDate} às ${booking.startTime} foi cancelado.`;

    const notifications: Notification[] = [];

    for (const userId of recipients) {
      notifications.push(
        Notification.create({
          userId: new UniqueEntityId(userId),
          type: isUpdated ? "BOOKING_UPDATED" : "BOOKING_CANCELLED",
          title,
          message,
          referenceType: "BOOKING",
          referenceId: booking.id,
          scheduledAt: new Date(),
          sentAt: new Date(),
        }),
      );
    }

    await this.notificationsRepository.createMany(notifications);
  }
}
