import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { FetchScheduleExceptionsUseCase } from "@/domain/application/use-cases/schedule/fetch-schedule-exceptions/fetch-schedule-exceptions";
import { FetchScheduleExceptionsController } from "../controllers/schedule/fetch-schedule-exceptions.controller";

export function makeFetchScheduleExceptionsController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const fetchScheduleExceptionsUseCase = new FetchScheduleExceptionsUseCase(
    scheduleExceptionsRepository,
  );
  return new FetchScheduleExceptionsController(fetchScheduleExceptionsUseCase);
}
