import type { Controller } from "../../../core/infra/controller";
import { GetServiceUseCase } from "../../../domain/application/use-cases/service/get-service/get-service";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { GetServiceController } from "../controllers/service/get-service.controller";

export function makeGetServiceController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const getServiceUseCase = new GetServiceUseCase(
    barbershopsRepository,
    servicesRepository,
  );

  return new GetServiceController(getServiceUseCase);
}
