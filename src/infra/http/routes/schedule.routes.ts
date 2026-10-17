import { Router } from "express";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { validateScheduleScope } from "../middlewares/validate-schedule-scope";
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
// Política de Leitura Pública (TEC-17):
// - Endpoint público (não exige JWT nem membership).
// - Sem filtro `?barbermanId=`: retorna todos os registros de jornada da unidade
//   (gerais com `barbermanId: null` e individuais dos profissionais).
// - Com `?barbermanId=:id`: retorna apenas os turnos daquele profissional.
scheduleRoutes.get(
  "/schedules",
  validateScheduleScope,
  adaptRoute(makeFetchBarbershopSchedulesController()),
);

// 2. PUT /barbershops/:shopId/schedules?barbermanId=
// - Exige autenticação JWT (`ensureUserIsAuthenticated`).
// - Valida precedência e não-divergência de escopo (`validateScheduleScope`).
scheduleRoutes.put(
  "/schedules",
  ensureUserIsAuthenticated,
  validateScheduleScope,
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
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateScheduleExceptionController()),
);

// 5. PATCH /barbershops/:shopId/schedule-exceptions/:exceptionId
scheduleRoutes.patch(
  "/schedule-exceptions/:exceptionId",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateScheduleExceptionController()),
);

// 6. DELETE /barbershops/:shopId/schedule-exceptions/:exceptionId
scheduleRoutes.delete(
  "/schedule-exceptions/:exceptionId",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeleteScheduleExceptionController()),
);

// 7. GET /barbershops/:shopId/availability?date=&serviceIds=&barbermanId=
scheduleRoutes.get(
  "/availability",
  adaptRoute(makeCalculateAvailabilityController()),
);

export { scheduleRoutes };
