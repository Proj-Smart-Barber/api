import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

import { makeFetchBarbermanDailyScheduleController } from "../factories/make-fetch-barberman-daily-schedule-controller";
import { makeCancelBookingController } from "../factories/make-cancel-booking-controller";
import { makeCreateBookingController } from "../factories/make-create-booking-controller";
import { makeFetchBarbermanDailyScheduleWithDetailsController } from "../factories/make-fetch-barberman-daily-schedule-with-details-controller";
import { makeFetchMyBookingsController } from "../factories/make-fetch-my-bookings-controller";
import { makeGetBookingByIdController } from "../factories/make-get-booking-by-id-controller";
import { makeRescheduleBookingController } from "../factories/make-reschedule-booking-controller";
import { makeTransitionBookingStatusController } from "../factories/make-transition-booking-status-controller";
import { makeCreateReviewController } from "../factories/make-create-review-controller";
import { makeUpdateReviewController } from "../factories/make-update-review-controller";
import { makeDeleteReviewController } from "../factories/make-delete-review-controller";
import { makeGetBookingReviewController } from "../factories/make-get-booking-review-controller";

const bookingRoutes = Router();

bookingRoutes.post(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateBookingController()),
);
bookingRoutes.get(
  "/me",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchMyBookingsController()),
);
bookingRoutes.get(
  "/barberman/schedule",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchBarbermanDailyScheduleController()),
);
bookingRoutes.get(
  "/barberman/schedule/details",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchBarbermanDailyScheduleWithDetailsController()),
);
bookingRoutes.get(
  "/:bookingId",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetBookingByIdController()),
);
bookingRoutes.delete(
  "/:bookingId/cancel",
  ensureUserIsAuthenticated,
  adaptRoute(makeCancelBookingController()),
);
bookingRoutes.patch(
  "/:bookingId/reschedule",
  ensureUserIsAuthenticated,
  adaptRoute(makeRescheduleBookingController()),
);
bookingRoutes.patch(
  "/:bookingId/status",
  ensureUserIsAuthenticated,
  adaptRoute(makeTransitionBookingStatusController()),
);
bookingRoutes.post(
  "/:bookingId/review",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateReviewController()),
);
bookingRoutes.patch(
  "/:bookingId/review",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateReviewController()),
);
bookingRoutes.delete(
  "/:bookingId/review",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeleteReviewController()),
);
bookingRoutes.get(
  "/:bookingId/review",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetBookingReviewController()),
);

export { bookingRoutes };
