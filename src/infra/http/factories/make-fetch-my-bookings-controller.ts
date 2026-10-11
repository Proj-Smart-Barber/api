import { DrizzleBookingsRepository } from "../drizzle/repositories/drizzle-bookings-repository";
import { FetchMyBookingsController } from "../controllers/booking/fetch-my-bookings.controller";

export function makeFetchMyBookingsController(): FetchMyBookingsController {
  const bookingsRepository = new DrizzleBookingsRepository();
  return new FetchMyBookingsController(bookingsRepository);
}
