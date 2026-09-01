import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateStaffController } from "../factories/make-create-staff-controller";

const staffRoutes = Router();

staffRoutes.post("/", adaptRoute(makeCreateStaffController()));

export { staffRoutes };
