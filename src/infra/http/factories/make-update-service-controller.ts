import type { Controller } from "../../../core/infra/controller";
import { UpdateServiceUseCase } from "../../../domain/application/use-cases/service/update-service/update-service";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { UpdateServiceController } from "../controllers/service/update-service.controller";

export function makeUpdateServiceController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const updateServiceUseCase = new UpdateServiceUseCase(
    barbershopsRepository,
    servicesRepository,
    unitOfWork,
  );

  return new UpdateServiceController(updateServiceUseCase);
}
