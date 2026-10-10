import { CancelBookingUseCase } from "../../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { CancelBookingController } from "../controllers/cancel-booking-controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { NotifyBookingEventUseCase } from "../../../domain/application/use-cases/notifications/notify-booking-event/notify-booking-event";

export function makeCancelBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleBarbershopsRepository = new DrizzleBarbershopsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const notifyBookingEventUseCase = new NotifyBookingEventUseCase(
    drizzleNotificationsRepository,
  );
  const cancelBookingUseCase = new CancelBookingUseCase(
    drizzleBookingsRepository,
    drizzleBarbershopsRepository,
    notifyBookingEventUseCase,
  );
  return new CancelBookingController(cancelBookingUseCase);
}
