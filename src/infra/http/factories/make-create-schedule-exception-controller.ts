import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { CreateScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/create-schedule-exception/create-schedule-exception";
import { CreateScheduleExceptionController } from "../controllers/schedule/create-schedule-exception.controller";

export function makeCreateScheduleExceptionController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const createScheduleExceptionUseCase = new CreateScheduleExceptionUseCase(
    scheduleExceptionsRepository,
  );
  return new CreateScheduleExceptionController(createScheduleExceptionUseCase);
}
