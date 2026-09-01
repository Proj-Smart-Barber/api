import type { Controller } from "../../../core/infra/controller";
import { CreateStaffUseCase } from "../../../domain/application/use-cases/staff/create-staff/create-staff";
import { DrizzleStaffsRepository } from "../../drizzle/repositories/drizzle-staffs-repository";
import { CreateStaffController } from "../controllers/create-staff-controller";

export function makeCreateStaffController(): Controller {
  const staffsRepository = new DrizzleStaffsRepository();
  const createStaffUseCase = new CreateStaffUseCase(staffsRepository);
  const createStaffController = new CreateStaffController(createStaffUseCase);

  return createStaffController;
}
