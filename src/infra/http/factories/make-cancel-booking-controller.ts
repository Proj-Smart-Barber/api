import { CancelBookingUseCase } from "../../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { CancelBookingController } from "../controllers/cancel-booking-controller";
import { InMemoryBookingsRepository } from "../../../../test/repositories/in-memory-bookings-repository";

export function makeCancelBookingController() {
  const inMemoryBookingsRepository = new InMemoryBookingsRepository();
  const cancelBookingUseCase = new CancelBookingUseCase(
    inMemoryBookingsRepository,
  );
  return new CancelBookingController(cancelBookingUseCase);
}
