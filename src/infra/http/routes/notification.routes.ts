import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeFetchNotificationsController } from "../factories/make-fetch-notifications-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

const notificationRoutes = Router();

// GET /notifications
notificationRoutes.get(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchNotificationsController()),
);

export { notificationRoutes };
