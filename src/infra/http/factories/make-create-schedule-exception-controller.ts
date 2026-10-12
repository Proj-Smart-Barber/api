import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { CreateScheduleExceptionUseCase } from "../../../domain/application/use-cases/schedule/create-schedule-exception/create-schedule-exception";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { CreateScheduleExceptionController } from "../controllers/schedule/create-schedule-exception.controller";

export function makeCreateScheduleExceptionController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const createScheduleExceptionUseCase = new CreateScheduleExceptionUseCase(
    scheduleExceptionsRepository,
    barbershopsRepository,
    unitOfWork,
  );
  return new CreateScheduleExceptionController(createScheduleExceptionUseCase);
}
