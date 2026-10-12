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

export { bookingRoutes };
