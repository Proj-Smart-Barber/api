import { FetchBarbermanDailyScheduleWithDetailsUseCase } from "@/domain/application/use-cases/booking/fetch-barberman-daily-schedule-with-details/fetch-barberman-daily-schedule-with-details";
import { DrizzleBookingsRepository } from "@/infra/drizzle/repositories/drizzle-bookings-repository";
import { FetchBarbermanDailyScheduleWithDetailsController } from "../controllers/fetch-barberman-daily-schedule-with-details-controller";

// import { InMemoryBookingsRepository } from "../../../../test/repositories/in-memory-bookings-repository";
// import { UniqueEntityId } from "@/core/entities/unique-entity-id";
// import { Booking } from "@/domain/enterprise/entities/booking";

export function makeFetchBarbermanDailyScheduleWithDetailsController() {
  // const inMemoryBookingsRepository = new InMemoryBookingsRepository();
  // const today = new Date();

  // const mockBooking = Booking.create(
  //   {
  //     barbershopId: new UniqueEntityId("barbershop-1"),
  //     barbermanId: new UniqueEntityId("957cf329-b48c-4f93-9cdc-73d682dffba6"),
  //     shoppingCartId: new UniqueEntityId("cart-1"),
  //     date: today,
  //     startTime: "10:00",
  //     endTime: "11:00",
  //     createdAt: new Date("2026-09-11T12:00:00.000Z"),
  //   },
  //   new UniqueEntityId("booking-teste-123"),
  // );

  // inMemoryBookingsRepository.items = [mockBooking];
  // const useCase = new FetchBarbermanDailyScheduleWithDetailsUseCase(
  //   inMemoryBookingsRepository,
  // );

  const bookingsRepository = new DrizzleBookingsRepository();
  const useCase = new FetchBarbermanDailyScheduleWithDetailsUseCase(
    bookingsRepository,
  );

  return new FetchBarbermanDailyScheduleWithDetailsController(useCase);
}
