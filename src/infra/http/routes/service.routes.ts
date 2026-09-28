import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureStaffIsAuthenticated } from "../middlewares/ensure-staff-is-authenticated";
import { optionalStaffAuthentication } from "../middlewares/optional-staff-authentication";
import { makeCreateServiceController } from "../factories/make-create-service-controller";
import { makeUpdateServiceController } from "../factories/make-update-service-controller";
import { makeToggleServiceActivationController } from "../factories/make-toggle-service-activation-controller";
import { makeListServicesController } from "../factories/make-list-services-controller";
import { makeGetServiceController } from "../factories/make-get-service-controller";

const serviceRoutes = Router({ mergeParams: true });

serviceRoutes.get(
  "/",
  optionalStaffAuthentication,
  adaptRoute(makeListServicesController()),
);

serviceRoutes.post(
  "/",
  ensureStaffIsAuthenticated,
  adaptRoute(makeCreateServiceController()),
);

serviceRoutes.get(
  "/:serviceId",
  optionalStaffAuthentication,
  adaptRoute(makeGetServiceController()),
);

serviceRoutes.patch(
  "/:serviceId",
  ensureStaffIsAuthenticated,
  adaptRoute(makeUpdateServiceController()),
);

serviceRoutes.patch(
  "/:serviceId/activation",
  ensureStaffIsAuthenticated,
  adaptRoute(makeToggleServiceActivationController()),
);

export { serviceRoutes };
