import { CreateBookingUseCase } from "../../../domain/application/use-cases/booking/create-booking/create-booking";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleShoppingCartsRepository } from "../../drizzle/repositories/drizzle-shopping-carts-repository";
import { CreateBookingController } from "../controllers/create-booking-controller";

export function makeCreateBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleShoppingCartsRepository = new DrizzleShoppingCartsRepository();
  const createBookingUseCase = new CreateBookingUseCase(
    drizzleBookingsRepository,
    drizzleShoppingCartsRepository,
  );
  return new CreateBookingController(createBookingUseCase);
}
