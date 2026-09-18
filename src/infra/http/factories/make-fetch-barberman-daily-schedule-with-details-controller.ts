import { FetchBarbermanDailyScheduleWithDetailsUseCase } from "@/domain/application/use-cases/booking/fetch-barberman-daily-schedule-with-details/fetch-barberman-daily-schedule-with-details";
import { DrizzleBookingsRepository } from "@/infra/drizzle/repositories/drizzle-bookings-repository";
import { FetchBarbermanDailyScheduleWithDetailsController } from "../controllers/fetch-barberman-daily-schedule-with-details-controller";

export function makeFetchBarbermanDailyScheduleWithDetailsController() {
  const bookingsRepository = new DrizzleBookingsRepository();
  const useCase = new FetchBarbermanDailyScheduleWithDetailsUseCase(
    bookingsRepository,
  );

  return new FetchBarbermanDailyScheduleWithDetailsController(useCase);
}
