import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureStaffIsAuthenticated } from "../middlewares/ensure-staff-is-authenticated";

// import { makeCreateBookingController } from "../factories/make-create-booking-controller";
// import { makeGetAvailableSlotsController } from "../factories/make-get-available-slots-controller";
import { makeFetchBarbermanDailyScheduleController } from "../factories/make-fetch-barberman-daily-schedule-controller";
import { makeCancelBookingController } from "../factories/make-cancel-booking-controller";
import { makeFetchBarbermanDailyScheduleWithDetailsController } from "../factories/make-fetch-barberman-daily-schedule-with-details-controller";
const bookingRoutes = Router();

// bookingRoutes.get(
//   "/available-slots",
//   adaptRoute(makeGetAvailableSlotsController()),
// );

// bookingRoutes.post(
//   "/",
//   ensureStaffIsAuthenticated,
//   adaptRoute(makeCreateBookingController()),
// );
bookingRoutes.get(
  "/barberman/schedule",
  ensureStaffIsAuthenticated,
  adaptRoute(makeFetchBarbermanDailyScheduleController()),
);
bookingRoutes.get(
  "/barberman/schedule/details",
  ensureStaffIsAuthenticated,
  adaptRoute(makeFetchBarbermanDailyScheduleWithDetailsController()),
);
bookingRoutes.delete(
  "/:bookingId/cancel",
  ensureStaffIsAuthenticated,
  adaptRoute(makeCancelBookingController()),
);

export { bookingRoutes };
