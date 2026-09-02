import type { Controller } from "../../../core/infra/controller";
import { SignInStaffUseCase } from "../../../domain/application/use-cases/staff/sign-in-staff/sign-in-staff";
import { DrizzleStaffsRepository } from "../../drizzle/repositories/drizzle-staffs-repository";
import { SignInStaffController } from "../controllers/sign-in-staff-controller";

export function makeSignInStaffController(): Controller {
  const staffsRepository = new DrizzleStaffsRepository();
  const signInStaffUseCase = new SignInStaffUseCase(staffsRepository);
  const signInStaffController = new SignInStaffController(signInStaffUseCase);

  return signInStaffController;
}
