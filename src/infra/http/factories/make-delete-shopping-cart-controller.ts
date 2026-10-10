import { DeleteShoppingCartUseCase } from "../../../domain/application/use-cases/shopping-cart/delete-shopping-cart/delete-shopping-cart";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleShoppingCartsRepository } from "../../drizzle/repositories/drizzle-shopping-carts-repository";
import { DeleteShoppingCartController } from "../controllers/delete-shopping-cart.controller";

export function makeDeleteShoppingCartController() {
  const drizzleShoppingCartsRepository = new DrizzleShoppingCartsRepository();
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const deleteShoppingCartUseCase = new DeleteShoppingCartUseCase(
    drizzleShoppingCartsRepository,
    drizzleBookingsRepository,
  );
  return new DeleteShoppingCartController(deleteShoppingCartUseCase);
}
