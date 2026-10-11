import { DrizzleBookingsRepository } from "../drizzle/repositories/drizzle-bookings-repository";
import { GetBookingByIdController } from "../controllers/booking/get-booking-by-id.controller";

export function makeGetBookingByIdController(): GetBookingByIdController {
  const bookingsRepository = new DrizzleBookingsRepository();
  return new GetBookingByIdController(bookingsRepository);
}
