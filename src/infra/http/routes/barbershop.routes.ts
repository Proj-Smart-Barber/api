import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateBarbershopController } from "../factories/make-create-barbershop-controller";
import { makeGetBarbershopController } from "../factories/make-get-barbershop-controller";
import { ensureStaffIsAuthenticated } from "../middlewares/ensure-staff-is-authenticated";

const barbershopRoutes = Router();

barbershopRoutes.post(
  "/",
  ensureStaffIsAuthenticated,
  adaptRoute(makeCreateBarbershopController()),
);
barbershopRoutes.get("/:shopId", adaptRoute(makeGetBarbershopController()));

export { barbershopRoutes };
