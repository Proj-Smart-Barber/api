import { UpdateBookingUseCase } from "../../../domain/application/use-cases/booking/update-booking/update-booking";
import { UpdateBookingController } from "../controllers/update-booking-controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";

export function makeUpdateBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleBarbershopsRepository = new DrizzleBarbershopsRepository();
  const updateBookingUseCase = new UpdateBookingUseCase(
    drizzleBookingsRepository,
    drizzleBarbershopsRepository,
  );
  return new UpdateBookingController(updateBookingUseCase);
}
