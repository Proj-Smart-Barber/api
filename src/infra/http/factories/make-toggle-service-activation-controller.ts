import type { Controller } from "../../../core/infra/controller";
import { ToggleServiceActivationUseCase } from "../../../domain/application/use-cases/service/toggle-service-activation/toggle-service-activation";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { ToggleServiceActivationController } from "../controllers/service/toggle-service-activation.controller";

export function makeToggleServiceActivationController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const toggleServiceActivationUseCase = new ToggleServiceActivationUseCase(
    barbershopsRepository,
    servicesRepository,
    unitOfWork,
  );

  return new ToggleServiceActivationController(toggleServiceActivationUseCase);
}
