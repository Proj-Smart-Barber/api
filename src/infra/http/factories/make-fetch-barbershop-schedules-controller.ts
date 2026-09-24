import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { FetchBarbershopSchedulesUseCase } from "../../../domain/application/use-cases/schedule/fetch-barbershop-schedules/fetch-barbershop-schedules";
import { FetchBarbershopSchedulesController } from "../controllers/schedule/fetch-barbershop-schedules.controller";

export function makeFetchBarbershopSchedulesController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const fetchBarbershopSchedulesUseCase = new FetchBarbershopSchedulesUseCase(
    schedulesRepository,
  );
  return new FetchBarbershopSchedulesController(
    fetchBarbershopSchedulesUseCase,
  );
}
