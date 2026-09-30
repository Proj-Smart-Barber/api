import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { optionalUserAuthentication } from "../middlewares/optional-user-authentication";
import { makeCreateServiceController } from "../factories/make-create-service-controller";
import { makeUpdateServiceController } from "../factories/make-update-service-controller";
import { makeToggleServiceActivationController } from "../factories/make-toggle-service-activation-controller";
import { makeListServicesController } from "../factories/make-list-services-controller";
import { makeGetServiceController } from "../factories/make-get-service-controller";

const serviceRoutes = Router({ mergeParams: true });

serviceRoutes.get(
  "/",
  optionalUserAuthentication,
  adaptRoute(makeListServicesController()),
);

serviceRoutes.post(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateServiceController()),
);

serviceRoutes.get(
  "/:serviceId",
  optionalUserAuthentication,
  adaptRoute(makeGetServiceController()),
);

serviceRoutes.patch(
  "/:serviceId",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateServiceController()),
);

serviceRoutes.patch(
  "/:serviceId/activation",
  ensureUserIsAuthenticated,
  adaptRoute(makeToggleServiceActivationController()),
);

export { serviceRoutes };
