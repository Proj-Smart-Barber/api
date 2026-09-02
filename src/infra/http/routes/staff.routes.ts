import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateStaffController } from "../factories/make-create-staff-controller";
import { makeSignInStaffController } from "../factories/make-sign-in-staff-controller";

const staffRoutes = Router();

staffRoutes.post("/", adaptRoute(makeCreateStaffController()));
staffRoutes.post("/sessions/auth", adaptRoute(makeSignInStaffController()));

export { staffRoutes };
