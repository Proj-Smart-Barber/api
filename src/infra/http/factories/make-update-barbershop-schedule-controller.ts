import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { UpdateBarbershopScheduleUseCase } from "../../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { UpdateBarbershopScheduleController } from "../controllers/schedule/update-barbershop-schedule.controller";

export function makeUpdateBarbershopScheduleController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const bookingsRepository = new DrizzleBookingsRepository();
  const updateBarbershopScheduleUseCase = new UpdateBarbershopScheduleUseCase(
    schedulesRepository,
    barbershopsRepository,
    bookingsRepository,
  );
  return new UpdateBarbershopScheduleController(
    updateBarbershopScheduleUseCase,
  );
}
