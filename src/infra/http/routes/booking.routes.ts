import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { ensureStaffIsAuthenticated } from "../middlewares/ensure-staff-is-authenticated";

// import { makeCreateBookingController } from "../factories/make-create-booking-controller";
// import { makeGetAvailableSlotsController } from "../factories/make-get-available-slots-controller";
import { makeFetchBarbermanDailyScheduleController } from "../factories/make-fetch-barberman-daily-schedule-controller";
import { makeCancelBookingController } from "../factories/make-cancel-booking-controller";

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
  "/barberman/:barbermanId/schedule",
  ensureStaffIsAuthenticated,
  adaptRoute(makeFetchBarbermanDailyScheduleController()),
);
bookingRoutes.patch(
  "/:bookingId/cancel",
  ensureStaffIsAuthenticated,
  adaptRoute(makeCancelBookingController()),
);

export { bookingRoutes };
