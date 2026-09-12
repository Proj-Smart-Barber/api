import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import {
  updateBarbershopScheduleController,
  createScheduleExceptionController,
  deleteScheduleExceptionController,
  calculateAvailabilityController,
  fetchBarbershopSchedulesController,
  fetchScheduleExceptionsController,
} from "../factories/schedule-factory";

const scheduleRoutes = Router({ mergeParams: true });

// 1. GET /barbershops/:shopId/schedules?barbermanId=
scheduleRoutes.get(
  "/schedules",
  adaptRoute(fetchBarbershopSchedulesController),
);

// 2. PUT /barbershops/:shopId/schedules
scheduleRoutes.put(
  "/schedules",
  adaptRoute(updateBarbershopScheduleController),
);

// 3. GET /barbershops/:shopId/schedule-exceptions?barbermanId=
scheduleRoutes.get(
  "/schedule-exceptions",
  adaptRoute(fetchScheduleExceptionsController),
);

// 4. POST /barbershops/:shopId/schedule-exceptions
scheduleRoutes.post(
  "/schedule-exceptions",
  adaptRoute(createScheduleExceptionController),
);

// 5. PATCH /barbershops/:shopId/schedule-exceptions/:exceptionId
scheduleRoutes.patch("/schedule-exceptions/:exceptionId", (req, res) => {
  // UseCase PATCH não foi solicitado no passo 3, retornamos sucesso genérico
  res.status(200).json({ message: "Exceção atualizada (mock)." });
});

// 6. DELETE /barbershops/:shopId/schedule-exceptions/:exceptionId
scheduleRoutes.delete(
  "/schedule-exceptions/:exceptionId",
  adaptRoute(deleteScheduleExceptionController),
);

// 7. GET /barbershops/:shopId/availability?date=&serviceIds=&barbermanId=
scheduleRoutes.get(
  "/availability",
  adaptRoute(calculateAvailabilityController),
);

export { scheduleRoutes };
