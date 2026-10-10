import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { makeCreateShoppingCartController } from "../factories/make-create-shopping-cart-controller";
import { makeDeleteShoppingCartController } from "../factories/make-delete-shopping-cart-controller";
import { makeFetchShoppingCartsController } from "../factories/make-fetch-shopping-carts-controller";

const shoppingCartRoutes = Router();

shoppingCartRoutes.post(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateShoppingCartController()),
);

shoppingCartRoutes.get(
  "/me",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchShoppingCartsController()),
);

shoppingCartRoutes.delete(
  "/:cartId",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeleteShoppingCartController()),
);

export { shoppingCartRoutes };
