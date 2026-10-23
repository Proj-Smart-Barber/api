import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { makeInitiateMediaUploadController } from "../factories/make-initiate-media-upload-controller";
import { makeConfirmMediaUploadController } from "../factories/make-confirm-media-upload-controller";
import { makeGetMediaStatusController } from "../factories/make-get-media-status-controller";

const mediaRoutes = Router();

mediaRoutes.get(
  "/:mediaId/status",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetMediaStatusController()),
);

mediaRoutes.post(
  "/upload-intent",
  ensureUserIsAuthenticated,
  adaptRoute(makeInitiateMediaUploadController()),
);

mediaRoutes.post(
  "/:mediaId/confirm",
  ensureUserIsAuthenticated,
  adaptRoute(makeConfirmMediaUploadController()),
);

export { mediaRoutes };
