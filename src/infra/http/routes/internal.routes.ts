import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeRefreshLocationsMaintenanceController } from "../factories/make-refresh-locations-maintenance-controller";
import { makeStorageCleanupController } from "../factories/make-storage-cleanup-controller";

const internalRoutes = Router();

internalRoutes.get(
  "/locations/refresh",
  adaptRoute(makeRefreshLocationsMaintenanceController()),
);

internalRoutes.get(
  "/storage/cleanup",
  adaptRoute(makeStorageCleanupController()),
);

internalRoutes.post(
  "/storage/cleanup",
  adaptRoute(makeStorageCleanupController()),
);

export { internalRoutes };
