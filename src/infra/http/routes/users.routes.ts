import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateUserController } from "../factories/make-create-user-controller";
import { makeSignInUserController } from "../factories/make-sign-in-user-controller";
import { makeRefreshSessionController } from "../factories/make-refresh-session-controller";
import { makeSignOutController } from "../factories/make-sign-out-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { makeGetUserProfileController } from "../factories/make-get-user-profile-controller";
import { makeFetchUserBarbershopsController } from "../factories/make-fetch-user-barbershops-controller";
import { makeSendEmailVerificationController } from "../factories/make-send-email-verification-controller";
import { makeVerifyEmailController } from "../factories/make-verify-email-controller";
import { makeSendPasswordRecoveryController } from "../factories/make-send-password-recovery-controller";
import { makeResetPasswordController } from "../factories/make-reset-password-controller";

const userRoutes = Router();

userRoutes.post("/", adaptRoute(makeCreateUserController()));
userRoutes.post("/sessions/auth", adaptRoute(makeSignInUserController()));
userRoutes.post(
  "/sessions/refresh",
  adaptRoute(makeRefreshSessionController()),
);
userRoutes.post("/sessions/sign-out", adaptRoute(makeSignOutController()));
userRoutes.post(
  "/verification-email",
  adaptRoute(makeSendEmailVerificationController()),
);
userRoutes.get(
  "/verification-email/confirm",
  adaptRoute(makeVerifyEmailController()),
);
userRoutes.post(
  "/password-recovery",
  adaptRoute(makeSendPasswordRecoveryController()),
);
userRoutes.post(
  "/password-recovery/reset",
  adaptRoute(makeResetPasswordController()),
);
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
