import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { UpdateScheduleExceptionUseCase } from "../../../domain/application/use-cases/schedule/update-schedule-exception/update-schedule-exception";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { UpdateScheduleExceptionController } from "../controllers/schedule/update-schedule-exception.controller";

export function makeUpdateScheduleExceptionController() {
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const bookingsRepository = new DrizzleBookingsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const updateScheduleExceptionUseCase = new UpdateScheduleExceptionUseCase(
    scheduleExceptionsRepository,
    barbershopsRepository,
    unitOfWork,
    membershipsRepository,
    bookingsRepository,
  );
  return new UpdateScheduleExceptionController(updateScheduleExceptionUseCase);
}
