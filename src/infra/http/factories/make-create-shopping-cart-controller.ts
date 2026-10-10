import { CreateShoppingCartUseCase } from "../../../domain/application/use-cases/shopping-cart/create-shopping-cart/create-shopping-cart";
import { DrizzleServiceItemsRepository } from "../../drizzle/repositories/drizzle-service-items-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { DrizzleShoppingCartsRepository } from "../../drizzle/repositories/drizzle-shopping-carts-repository";
import { CreateShoppingCartController } from "../controllers/create-shopping-cart.controller";

export function makeCreateShoppingCartController() {
  const drizzleShoppingCartsRepository = new DrizzleShoppingCartsRepository();
  const drizzleServiceItemsRepository = new DrizzleServiceItemsRepository();
  const drizzleServicesRepository = new DrizzleServicesRepository();
  const createShoppingCartUseCase = new CreateShoppingCartUseCase(
    drizzleShoppingCartsRepository,
    drizzleServiceItemsRepository,
    drizzleServicesRepository,
  );
  return new CreateShoppingCartController(createShoppingCartUseCase);
}
