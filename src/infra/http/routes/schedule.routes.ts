import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeUpdateBarbershopScheduleController } from "../factories/make-update-barbershop-schedule-controller";
import { makeCreateScheduleExceptionController } from "../factories/make-create-schedule-exception-controller";
import { makeDeleteScheduleExceptionController } from "../factories/make-delete-schedule-exception-controller";
import { makeUpdateScheduleExceptionController } from "../factories/make-update-schedule-exception-controller";
import { makeCalculateAvailabilityController } from "../factories/make-calculate-availability-controller";
import { makeFetchBarbershopSchedulesController } from "../factories/make-fetch-barbershop-schedules-controller";
import { makeFetchScheduleExceptionsController } from "../factories/make-fetch-schedule-exceptions-controller";

const scheduleRoutes = Router({ mergeParams: true });

// 1. GET /barbershops/:shopId/schedules?barbermanId=
scheduleRoutes.get(
  "/schedules",
  adaptRoute(makeFetchBarbershopSchedulesController()),
);

// 2. PUT /barbershops/:shopId/schedules
scheduleRoutes.put(
  "/schedules",
  adaptRoute(makeUpdateBarbershopScheduleController()),
);

// 3. GET /barbershops/:shopId/schedule-exceptions?barbermanId=
scheduleRoutes.get(
  "/schedule-exceptions",
  adaptRoute(makeFetchScheduleExceptionsController()),
);

// 4. POST /barbershops/:shopId/schedule-exceptions
scheduleRoutes.post(
  "/schedule-exceptions",
  adaptRoute(makeCreateScheduleExceptionController()),
);

// 5. PATCH /barbershops/:shopId/schedule-exceptions/:exceptionId
scheduleRoutes.patch(
  "/schedule-exceptions/:exceptionId",
  adaptRoute(makeUpdateScheduleExceptionController()),
);

// 6. DELETE /barbershops/:shopId/schedule-exceptions/:exceptionId
scheduleRoutes.delete(
  "/schedule-exceptions/:exceptionId",
  adaptRoute(makeDeleteScheduleExceptionController()),
);

// 7. GET /barbershops/:shopId/availability?date=&serviceIds=&barbermanId=
scheduleRoutes.get(
  "/availability",
  adaptRoute(makeCalculateAvailabilityController()),
);

export { scheduleRoutes };
