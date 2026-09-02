import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateStaffController } from "../factories/make-create-staff-controller";
import { makeSignInStaffController } from "../factories/make-sign-in-staff-controller";
import { ensureStaffIsAuthenticated } from "../middlewares/ensure-staff-is-authenticated";
import { makeGetStaffProfileController } from "../factories/make-get-staff-profile-controller";

const staffRoutes = Router();

staffRoutes.post("/", adaptRoute(makeCreateStaffController()));
staffRoutes.post("/sessions/auth", adaptRoute(makeSignInStaffController()));
staffRoutes.get(
  "/me",
  ensureStaffIsAuthenticated,
  adaptRoute(makeGetStaffProfileController()),
);

export { staffRoutes };
