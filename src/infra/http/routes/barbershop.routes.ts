import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeGetBarbershopController } from "../factories/make-get-barbershop-controller";

const barbershopRoutes = Router();

barbershopRoutes.get("/:shopId", adaptRoute(makeGetBarbershopController()));

export { barbershopRoutes };
