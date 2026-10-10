import { UpdateBookingUseCase } from "../../../domain/application/use-cases/booking/update-booking/update-booking";
import { UpdateBookingController } from "../controllers/update-booking-controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";

export function makeUpdateBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleBarbershopsRepository = new DrizzleBarbershopsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const updateBookingUseCase = new UpdateBookingUseCase(
    drizzleBookingsRepository,
    drizzleBarbershopsRepository,
    drizzleNotificationsRepository,
  );
  return new UpdateBookingController(updateBookingUseCase);
}
