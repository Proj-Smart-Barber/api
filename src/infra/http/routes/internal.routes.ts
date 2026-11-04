import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeProcessInvitationDeliveriesController } from "../factories/make-process-invitation-deliveries-controller";
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

internalRoutes.get(
  "/invitations/process-deliveries",
  adaptRoute(makeProcessInvitationDeliveriesController()),
);

internalRoutes.post(
  "/invitations/process-deliveries",
  adaptRoute(makeProcessInvitationDeliveriesController()),
);

export { internalRoutes };
