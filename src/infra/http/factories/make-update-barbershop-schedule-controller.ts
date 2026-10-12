import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { UpdateBarbershopScheduleUseCase } from "../../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { UpdateBarbershopScheduleController } from "../controllers/schedule/update-barbershop-schedule.controller";

export function makeUpdateBarbershopScheduleController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const updateBarbershopScheduleUseCase = new UpdateBarbershopScheduleUseCase(
    schedulesRepository,
    barbershopsRepository,
    unitOfWork,
  );
  return new UpdateBarbershopScheduleController(
    updateBarbershopScheduleUseCase,
  );
}
