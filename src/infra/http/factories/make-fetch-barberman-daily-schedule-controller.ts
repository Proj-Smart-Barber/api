import { FetchBarbermanDailyScheduleUseCase } from "../../../domain/application/use-cases/booking/fetch-staff-barberman-schedule/fetch-barberman-daily-schedule";
import { FetchBarbermanDailyScheduleController } from "../controllers/fetch-barberman-daily-schedule-controller";
import { DrizzleBookingsRepository } from "@/infra/drizzle/repositories/drizzle-bookings-repository";

//para teste mockado:
// import { InMemoryBookingsRepository } from "../../../../test/repositories/in-memory-bookings-repository";
// import { Booking } from "../../../domain/enterprise/entities/booking";
// import { UniqueEntityId } from "@/core/entities/unique-entity-id";

export function makeFetchBarbermanDailyScheduleController() {
  // const inMemoryBookingsRepository = new InMemoryBookingsRepository();

  // const mockBooking = Booking.create(
  //   {
  //     barbershopId: new UniqueEntityId("barbershop-1"),
  //     barbermanId: new UniqueEntityId("5ab89176-9347-47b7-b8ec-7f162a081aed"),
  //     shoppingCartId: new UniqueEntityId("cart-1"),
  //     createdAt: new Date("2026-09-10T12:00:00.000Z"),
  //   },
  //   new UniqueEntityId("booking-teste-123"),
  // );

  // inMemoryBookingsRepository.items = [mockBooking];
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const fetchBarbermanDailyScheduleUseCase =
    new FetchBarbermanDailyScheduleUseCase(drizzleBookingsRepository);

  return new FetchBarbermanDailyScheduleController(
    fetchBarbermanDailyScheduleUseCase,
  );
}
