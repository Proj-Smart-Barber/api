import { UpdateBookingUseCase } from "../../../domain/application/use-cases/booking/update-booking/update-booking";
import { UpdateBookingController } from "../controllers/update-booking-controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { NotifyBookingEventUseCase } from "../../../domain/application/use-cases/notifications/notify-booking-event/notify-booking-event";

export function makeUpdateBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleBarbershopsRepository = new DrizzleBarbershopsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const notifyBookingEventUseCase = new NotifyBookingEventUseCase(
    drizzleNotificationsRepository,
  );
  const updateBookingUseCase = new UpdateBookingUseCase(
    drizzleBookingsRepository,
    drizzleBarbershopsRepository,
    notifyBookingEventUseCase,
  );
  return new UpdateBookingController(updateBookingUseCase);
}
