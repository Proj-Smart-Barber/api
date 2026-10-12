import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateBarbershopController } from "../factories/make-create-barbershop-controller";
import { makeDeactivateUnitMembershipController } from "../factories/make-deactivate-unit-membership-controller";
import { makeGetBarbershopController } from "../factories/make-get-barbershop-controller";
import { makeListBarbershopProfessionalsController } from "../factories/make-list-barbershop-professionals-controller";
import { makeListUnitTeamController } from "../factories/make-list-unit-team-controller";
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
barbershopRoutes.get(
  "/:shopId/team",
  ensureUserIsAuthenticated,
  adaptRoute(makeListUnitTeamController()),
);
barbershopRoutes.patch(
  "/:shopId/team/:membershipId/deactivation",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeactivateUnitMembershipController()),
);
barbershopRoutes.use("/:shopId/services", serviceRoutes);

export { barbershopRoutes };
