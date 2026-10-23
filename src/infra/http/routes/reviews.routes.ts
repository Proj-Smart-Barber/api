import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { makeReportReviewController } from "../factories/make-report-review-controller";
import { makeModerateReviewController } from "../factories/make-moderate-review-controller";
import { makeListModerationQueueController } from "../factories/make-list-moderation-queue-controller";

const reviewsRoutes = Router();

// Report review
reviewsRoutes.post(
  "/:reviewId/report",
  ensureUserIsAuthenticated,
  adaptRoute(makeReportReviewController()),
);

// Admin moderation
reviewsRoutes.patch(
  "/:reviewId/moderation",
  ensureUserIsAuthenticated,
  adaptRoute(makeModerateReviewController()),
);

reviewsRoutes.get(
  "/moderation/queue",
  ensureUserIsAuthenticated,
  adaptRoute(makeListModerationQueueController()),
);

export { reviewsRoutes };
