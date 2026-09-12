import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { DeleteScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/delete-schedule-exception/delete-schedule-exception";
import { DeleteScheduleExceptionController } from "../controllers/schedule/delete-schedule-exception.controller";

export function makeDeleteScheduleExceptionController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const deleteScheduleExceptionUseCase = new DeleteScheduleExceptionUseCase(
    scheduleExceptionsRepository,
  );
  return new DeleteScheduleExceptionController(deleteScheduleExceptionUseCase);
}
