import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

import { makeFetchBarbermanDailyScheduleController } from "../factories/make-fetch-barberman-daily-schedule-controller";
import { makeCancelBookingController } from "../factories/make-cancel-booking-controller";
import { makeUpdateBookingController } from "../factories/make-update-booking-controller";
import { makeCreateBookingController } from "../factories/make-create-booking-controller";
import { makeFetchBarbermanDailyScheduleWithDetailsController } from "../factories/make-fetch-barberman-daily-schedule-with-details-controller";
const bookingRoutes = Router();

bookingRoutes.post(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateBookingController()),
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
bookingRoutes.delete(
  "/:bookingId/cancel",
  ensureUserIsAuthenticated,
  adaptRoute(makeCancelBookingController()),
);
bookingRoutes.patch(
  "/:bookingId/update",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateBookingController()),
);

export { bookingRoutes };
