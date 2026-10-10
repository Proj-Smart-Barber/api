import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { makeCreateServiceItemController } from "../factories/make-create-service-item-controller";

const serviceItemRoutes = Router();

serviceItemRoutes.post(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateServiceItemController()),
);

export { serviceItemRoutes };
