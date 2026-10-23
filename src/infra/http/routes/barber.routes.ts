import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeActivateBarberController } from "../factories/make-activate-barber-controller";

const barberRoutes = Router();

// POST /api/barbers/activate
barberRoutes.post("/activate", adaptRoute(makeActivateBarberController()));

export { barberRoutes };
