import { FetchBarbermanDailyScheduleUseCase } from "../../../domain/application/use-cases/booking/fetch-staff-barberman-schedule/fetch-barberman-daily-schedule";
import { FetchBarbermanDailyScheduleController } from "../controllers/fetch-barberman-daily-schedule-controller";
import { InMemoryBookingsRepository } from "../../../../test/repositories/in-memory-bookings-repository";

export function makeFetchBarbermanDailyScheduleController() {
  const inMemoryBookingsRepository = new InMemoryBookingsRepository();
  const fetchBarbermanDailyScheduleUseCase =
    new FetchBarbermanDailyScheduleUseCase(inMemoryBookingsRepository);
  return new FetchBarbermanDailyScheduleController(
    fetchBarbermanDailyScheduleUseCase,
  );
}
