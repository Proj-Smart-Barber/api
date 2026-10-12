import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { GetBookingByIdController } from "../controllers/booking/get-booking-by-id.controller";

export function makeGetBookingByIdController(): GetBookingByIdController {
  const bookingsRepository = new DrizzleBookingsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  return new GetBookingByIdController(
    bookingsRepository,
    membershipsRepository,
  );
}
