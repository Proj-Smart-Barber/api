import {MultipartUploadController} from "../controllers/media/multipart-upload.controller";
import { ResumeMediaUploadController } from "../controllers/media/resume-media-upload.controller";
import { CancelMediaUploadController } from "../controllers/media/cancel-media-upload.controller";
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

mediaRoutes.post(
  "/:mediaId/upload-url",
  ensureUserIsAuthenticated,
  adaptRoute(new ResumeMediaUploadController()),
);
mediaRoutes.delete(
  "/:mediaId",
  ensureUserIsAuthenticated,
  adaptRoute(new CancelMediaUploadController()),
);

mediaRoutes.post("/:mediaId/multipart",ensureUserIsAuthenticated,adaptRoute(new MultipartUploadController("start")));
mediaRoutes.post("/:mediaId/multipart/part",ensureUserIsAuthenticated,adaptRoute(new MultipartUploadController("part")));
mediaRoutes.post("/:mediaId/multipart/complete",ensureUserIsAuthenticated,adaptRoute(new MultipartUploadController("complete")));

export { mediaRoutes };
