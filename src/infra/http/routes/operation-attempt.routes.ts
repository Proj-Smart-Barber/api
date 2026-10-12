import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCloseOperationAttemptController } from "../factories/make-close-operation-attempt-controller";
import { makeGetOperationAttemptController } from "../factories/make-get-operation-attempt-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

const operationAttemptRoutes = Router();

operationAttemptRoutes.get(
  "/:requestId",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetOperationAttemptController()),
);

operationAttemptRoutes.post(
  "/:requestId/close",
  ensureUserIsAuthenticated,
  adaptRoute(makeCloseOperationAttemptController()),
);

export { operationAttemptRoutes };
