import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { CreateScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/create-schedule-exception/create-schedule-exception";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { CreateScheduleExceptionController } from "../controllers/schedule/create-schedule-exception.controller";

export function makeCreateScheduleExceptionController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const createScheduleExceptionUseCase = new CreateScheduleExceptionUseCase(
    scheduleExceptionsRepository,
    barbershopsRepository,
  );
  return new CreateScheduleExceptionController(createScheduleExceptionUseCase);
}
