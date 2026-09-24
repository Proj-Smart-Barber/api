import { FetchBarbermanDailyScheduleUseCase } from "../../../domain/application/use-cases/booking/fetch-staff-barberman-schedule/fetch-barberman-daily-schedule";
import { FetchBarbermanDailyScheduleController } from "../controllers/fetch-barberman-daily-schedule-controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";

export function makeFetchBarbermanDailyScheduleController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const fetchBarbermanDailyScheduleUseCase =
    new FetchBarbermanDailyScheduleUseCase(drizzleBookingsRepository);

  return new FetchBarbermanDailyScheduleController(
    fetchBarbermanDailyScheduleUseCase,
  );
}
