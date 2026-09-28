import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateStaffController } from "../factories/make-create-staff-controller";
import { makeSignInStaffController } from "../factories/make-sign-in-staff-controller";
import { ensureStaffIsAuthenticated } from "../middlewares/ensure-staff-is-authenticated";
import { makeGetStaffProfileController } from "../factories/make-get-staff-profile-controller";
import { makeFetchStaffBarbershopsController } from "../factories/make-fetch-staff-barbershops-controller";

const staffRoutes = Router();

staffRoutes.post("/", adaptRoute(makeCreateStaffController()));
staffRoutes.post("/sessions/auth", adaptRoute(makeSignInStaffController()));
staffRoutes.get(
  "/me",
  ensureStaffIsAuthenticated,
  adaptRoute(makeGetStaffProfileController()),
);
staffRoutes.get(
  "/me/barbershops",
  ensureStaffIsAuthenticated,
  adaptRoute(makeFetchStaffBarbershopsController()),
);

export { staffRoutes };
