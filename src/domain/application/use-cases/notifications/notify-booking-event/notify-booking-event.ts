import { generateUuidV7 } from "../../../../../core/security/uuidv7";
import type {
  CreateNotificationTxParams,
  NotificationsRepository,
} from "../../../repositories/notifications-repository";
import type { NotifyBookingEventDTO } from "./notify-booking-event-dto";

export class NotifyBookingEventUseCase {
  constructor(private notificationsRepository: NotificationsRepository) {}

  async execute({
    booking,
    barbershop,
    eventType,
    dateText,
    timeText,
    serverTime = new Date(),
    tx,
    previousBarbermanId,
  }: NotifyBookingEventDTO): Promise<void> {
    const recipients = new Set<string>();
    if (booking.customerId) recipients.add(booking.customerId.toString());
    recipients.add(booking.barbermanId.toString());
    if (barbershop?.ownerId) recipients.add(barbershop.ownerId.toString());
    if (previousBarbermanId) recipients.add(previousBarbermanId);

    // date is a civil day stored at UTC midnight, not a slot instant.
    const formattedDate =
      dateText ?? booking.date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    const formattedTime =
      timeText ?? `${booking.startTime} - ${booking.endTime}`;
    const isUpdated = eventType !== "CANCELLED";
    const message = isUpdated
      ? `O atendimento agendado para ${formattedDate} foi alterado para ${formattedTime}.`
      : `O atendimento agendado para ${formattedDate} às ${booking.startTime} foi cancelado.`;
    const notifications: CreateNotificationTxParams[] = Array.from(
      recipients,
      (userId) => ({
        userId,
        eventId: generateUuidV7(),
        type: isUpdated ? "BOOKING_RESCHEDULED" : "BOOKING_CANCELLED",
        title: isUpdated ? "Agendamento Reagendado" : "Agendamento Cancelado",
        message,
        referenceType: "BOOKING",
        referenceId: booking.id.toString(),
        scheduledAt: serverTime,
        sentAt: serverTime,
      }),
    );
    await this.notificationsRepository.createManyWithTx(notifications, tx);
  }
}
