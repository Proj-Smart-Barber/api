import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { UpdateBarbershopScheduleUseCase } from "../../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { UpdateBarbershopScheduleController } from "../controllers/schedule/update-barbershop-schedule.controller";

export function makeUpdateBarbershopScheduleController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const updateBarbershopScheduleUseCase = new UpdateBarbershopScheduleUseCase(
    schedulesRepository,
    barbershopsRepository,
    unitOfWork,
    membershipsRepository,
  );
  return new UpdateBarbershopScheduleController(
    updateBarbershopScheduleUseCase,
  );
}
