import type { Controller } from "../../../core/infra/controller";
import { GetStaffProfileUseCase } from "../../../domain/application/use-cases/staff/get-staff-profile/get-staff-profile";
import { DrizzleStaffsRepository } from "../../drizzle/repositories/drizzle-staffs-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { GetStaffProfileController } from "../controllers/get-staff-profile-controller";

export function makeGetStaffProfileController(): Controller {
  const staffsRepository = new DrizzleStaffsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const getStaffProfileUseCase = new GetStaffProfileUseCase(
    staffsRepository,
    barbershopsRepository,
  );
  const getStaffProfileController = new GetStaffProfileController(
    getStaffProfileUseCase,
  );

  return getStaffProfileController;
}
