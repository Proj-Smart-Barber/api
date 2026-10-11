import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateBarbershopController } from "../factories/make-create-barbershop-controller";
import { makeGetBarbershopController } from "../factories/make-get-barbershop-controller";
import { makeListBarbershopProfessionalsController } from "../factories/make-list-barbershop-professionals-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { serviceRoutes } from "./service.routes";

const barbershopRoutes = Router();

barbershopRoutes.post(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateBarbershopController()),
);
barbershopRoutes.get("/:shopId", adaptRoute(makeGetBarbershopController()));
barbershopRoutes.get(
  "/:shopId/professionals",
  adaptRoute(makeListBarbershopProfessionalsController()),
);
barbershopRoutes.use("/:shopId/services", serviceRoutes);

export { barbershopRoutes };
