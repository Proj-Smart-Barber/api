import { FetchShoppingCartsUseCase } from "../../../domain/application/use-cases/shopping-cart/fetch-shopping-carts/fetch-shopping-carts";
import { DrizzleShoppingCartsRepository } from "../../drizzle/repositories/drizzle-shopping-carts-repository";
import { FetchShoppingCartsController } from "../controllers/fetch-shopping-carts.controller";

export function makeFetchShoppingCartsController() {
  const drizzleShoppingCartsRepository = new DrizzleShoppingCartsRepository();
  const fetchShoppingCartsUseCase = new FetchShoppingCartsUseCase(
    drizzleShoppingCartsRepository,
  );
  return new FetchShoppingCartsController(fetchShoppingCartsUseCase);
}
