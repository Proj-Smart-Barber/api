import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateUserController } from "../factories/make-create-user-controller";
import { makeSignInUserController } from "../factories/make-sign-in-user-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { makeGetUserProfileController } from "../factories/make-get-user-profile-controller";
import { makeFetchUserBarbershopsController } from "../factories/make-fetch-user-barbershops-controller";

const userRoutes = Router();

userRoutes.post("/", adaptRoute(makeCreateUserController()));
userRoutes.post("/sessions/auth", adaptRoute(makeSignInUserController()));
userRoutes.get(
  "/me",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetUserProfileController()),
);
userRoutes.get(
  "/me/barbershops",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchUserBarbershopsController()),
);

export { userRoutes };
