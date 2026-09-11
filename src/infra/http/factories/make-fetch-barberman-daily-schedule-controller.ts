import { FetchBarbermanDailyScheduleUseCase } from "../../../domain/application/use-cases/booking/fetch-staff-barberman-schedule/fetch-barberman-daily-schedule";
import { FetchBarbermanDailyScheduleController } from "../controllers/fetch-barberman-daily-schedule-controller";
import { DrizzleBookingsRepository } from "@/infra/drizzle/repositories/drizzle-bookings-repository";

//para teste mockado:
// import { InMemoryBookingsRepository } from "../../../../test/repositories/in-memory-bookings-repository";
// import { Booking } from "../../../domain/enterprise/entities/booking";
// import { UniqueEntityId } from "@/core/entities/unique-entity-id";

export function makeFetchBarbermanDailyScheduleController() {
  // const inMemoryBookingsRepository = new InMemoryBookingsRepository();
  // const today = new Date()
  // const mockBooking = Booking.create(
  //   {
  //     barbershopId: new UniqueEntityId("barbershop-1"),
  //     barbermanId: new UniqueEntityId("4903d18d-ea6e-494e-9be6-ef9f47775034"),
  //     shoppingCartId: new UniqueEntityId("cart-1"),
  //     date:today,
  //     startTime:"10:00",
  //     endTime:"11:00",
  //     createdAt: new Date("2026-09-10T12:00:00.000Z"),
  //   },
  //   new UniqueEntityId("booking-teste-123"),
  // );

  // inMemoryBookingsRepository.items = [mockBooking];
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const fetchBarbermanDailyScheduleUseCase =
    new FetchBarbermanDailyScheduleUseCase(drizzleBookingsRepository);
  // new FetchBarbermanDailyScheduleUseCase(inMemoryBookingsRepository);

  return new FetchBarbermanDailyScheduleController(
    fetchBarbermanDailyScheduleUseCase,
  );
}
