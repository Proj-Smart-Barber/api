import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { UpdateBarbershopScheduleUseCase } from "../../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { UpdateBarbershopScheduleController } from "../controllers/schedule/update-barbershop-schedule.controller";

export function makeUpdateBarbershopScheduleController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const bookingsRepository = new DrizzleBookingsRepository();
  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();

  const operationAttemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  const updateBarbershopScheduleUseCase = new UpdateBarbershopScheduleUseCase(
    schedulesRepository,
    barbershopsRepository,
    unitOfWork,
    membershipsRepository,
    bookingsRepository,
    operationAttemptService,
  );
  return new UpdateBarbershopScheduleController(
    updateBarbershopScheduleUseCase,
  );
}
