import { CancelBookingUseCase } from "../../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { CancelBookingController } from "../controllers/cancel-booking-controller";
import { DrizzleBookingsRepository } from "@/infra/drizzle/repositories/drizzle-bookings-repository";

export function makeCancelBookingController() {
  // const inMemoryBookingsRepository = new InMemoryBookingsRepository();
  // const cancelBookingUseCase = new CancelBookingUseCase(
  //   inMemoryBookingsRepository,
  // );
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const cancelBookingUseCase = new CancelBookingUseCase(
    drizzleBookingsRepository,
  );
  return new CancelBookingController(cancelBookingUseCase);
}
