import type { Controller } from "../../../core/infra/controller";
import { ToggleServiceActivationUseCase } from "../../../domain/application/use-cases/service/toggle-service-activation/toggle-service-activation";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { ToggleServiceActivationController } from "../controllers/service/toggle-service-activation.controller";

export function makeToggleServiceActivationController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const toggleServiceActivationUseCase = new ToggleServiceActivationUseCase(
    barbershopsRepository,
    servicesRepository,
  );

  return new ToggleServiceActivationController(toggleServiceActivationUseCase);
}
