import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { DeleteScheduleExceptionUseCase } from "../../../domain/application/use-cases/schedule/delete-schedule-exception/delete-schedule-exception";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DeleteScheduleExceptionController } from "../controllers/schedule/delete-schedule-exception.controller";

export function makeDeleteScheduleExceptionController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const deleteScheduleExceptionUseCase = new DeleteScheduleExceptionUseCase(
    scheduleExceptionsRepository,
    barbershopsRepository,
    unitOfWork,
    membershipsRepository,
  );
  return new DeleteScheduleExceptionController(deleteScheduleExceptionUseCase);
}
