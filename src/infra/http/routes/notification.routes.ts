import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeFetchNotificationsController } from "../factories/make-fetch-notifications-controller";
import { makeMarkNotificationAsReadController } from "../factories/make-mark-notification-as-read-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

const notificationRoutes = Router();

// GET /notifications
notificationRoutes.get(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchNotificationsController()),
);

// PATCH /notifications/:notificationId/read
notificationRoutes.patch(
  "/:notificationId/read",
  ensureUserIsAuthenticated,
  adaptRoute(makeMarkNotificationAsReadController()),
);

export { notificationRoutes };
