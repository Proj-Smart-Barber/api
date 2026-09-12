import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { UpdateScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/update-schedule-exception/update-schedule-exception";
import { UpdateScheduleExceptionController } from "../controllers/schedule/update-schedule-exception.controller";

export function makeUpdateScheduleExceptionController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const updateScheduleExceptionUseCase = new UpdateScheduleExceptionUseCase(
    scheduleExceptionsRepository,
  );
  return new UpdateScheduleExceptionController(updateScheduleExceptionUseCase);
}
