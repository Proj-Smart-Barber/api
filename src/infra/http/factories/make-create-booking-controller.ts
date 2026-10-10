import { CreateBookingUseCase } from "../../../domain/application/use-cases/booking/create-booking/create-booking";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { CreateBookingController } from "../controllers/create-booking-controller";

export function makeCreateBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleServicesRepository = new DrizzleServicesRepository();
  const createBookingUseCase = new CreateBookingUseCase(
    drizzleBookingsRepository,
    drizzleServicesRepository,
  );
  return new CreateBookingController(createBookingUseCase);
}
