import { UpdateBookingUseCase } from "../../../domain/application/use-cases/booking/update-booking/update-booking";
import { UpdateBookingController } from "../controllers/update-booking-controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";

export function makeUpdateBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const updateBookingUseCase = new UpdateBookingUseCase(
    drizzleBookingsRepository,
  );
  return new UpdateBookingController(updateBookingUseCase);
}
