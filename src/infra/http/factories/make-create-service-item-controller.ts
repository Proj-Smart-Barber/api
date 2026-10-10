import { CreateServiceItemUseCase } from "../../../domain/application/use-cases/service-item/create-service-item/create-service-item";
import { DrizzleServiceItemsRepository } from "../../drizzle/repositories/drizzle-service-items-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { CreateServiceItemController } from "../controllers/create-service-item.controller";

export function makeCreateServiceItemController() {
  const drizzleServicesRepository = new DrizzleServicesRepository();
  const drizzleServiceItemsRepository = new DrizzleServiceItemsRepository();
  const createServiceItemUseCase = new CreateServiceItemUseCase(
    drizzleServicesRepository,
    drizzleServiceItemsRepository,
  );
  return new CreateServiceItemController(createServiceItemUseCase);
}
