import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeRefreshLocationsMaintenanceController } from "../factories/make-refresh-locations-maintenance-controller";

const internalRoutes = Router();

internalRoutes.get(
  "/locations/refresh",
  adaptRoute(makeRefreshLocationsMaintenanceController()),
);

export { internalRoutes };
