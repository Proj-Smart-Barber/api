import type { Controller } from "../../../core/infra/controller";
import { ListServicesUseCase } from "../../../domain/application/use-cases/service/list-services/list-services";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { ListServicesController } from "../controllers/service/list-services.controller";

export function makeListServicesController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const listServicesUseCase = new ListServicesUseCase(
    barbershopsRepository,
    servicesRepository,
  );

  return new ListServicesController(listServicesUseCase);
}
