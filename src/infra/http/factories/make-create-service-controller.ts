import type { Controller } from "../../../core/infra/controller";
import { CreateServiceUseCase } from "../../../domain/application/use-cases/service/create-service/create-service";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { CreateServiceController } from "../controllers/service/create-service.controller";

export function makeCreateServiceController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const createServiceUseCase = new CreateServiceUseCase(
    barbershopsRepository,
    servicesRepository,
  );

  return new CreateServiceController(createServiceUseCase);
}
