import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateUserController } from "../factories/make-create-user-controller";
import { makeSignInUserController } from "../factories/make-sign-in-user-controller";
import { makeRefreshSessionController } from "../factories/make-refresh-session-controller";
import {
  makeSignOutAllController,
  makeSignOutController,
} from "../factories/make-sign-out-controller";
import {
  makeConfirmEmailVerificationController,
  makeRequestEmailVerificationController,
} from "../factories/make-email-verification-controllers";
import {
  makeConfirmPasswordResetController,
  makeRequestPasswordResetController,
} from "../factories/make-password-reset-controllers";
import { makeChangePasswordController } from "../factories/make-change-password-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { makeGetUserProfileController } from "../factories/make-get-user-profile-controller";
import { makeFetchUserBarbershopsController } from "../factories/make-fetch-user-barbershops-controller";

const userRoutes = Router();

// Conta ────────────────────────────────────────────────────────
userRoutes.post("/", adaptRoute(makeCreateUserController()));

// Sessões ──────────────────────────────────────────────────────
userRoutes.post("/sessions/auth", adaptRoute(makeSignInUserController()));
userRoutes.post(
  "/sessions/refresh",
  adaptRoute(makeRefreshSessionController()),
);
userRoutes.post(
  "/sessions/logout",
  ensureUserIsAuthenticated,
  adaptRoute(makeSignOutController()),
);
userRoutes.post(
  "/sessions/logout-all",
  ensureUserIsAuthenticated,
  adaptRoute(makeSignOutAllController()),
);

// Confirmação de e-mail ────────────────────────────────────────
userRoutes.post(
  "/email-verifications/request",
  adaptRoute(makeRequestEmailVerificationController()),
);
userRoutes.post(
  "/email-verifications/confirm",
  adaptRoute(makeConfirmEmailVerificationController()),
);

// Recuperação de acesso ───────────────────────────────────────
userRoutes.post(
  "/password-resets/request",
  adaptRoute(makeRequestPasswordResetController()),
);
userRoutes.post(
  "/password-resets/confirm",
  adaptRoute(makeConfirmPasswordResetController()),
);

// Conta autenticada ────────────────────────────────────────────
userRoutes.get(
  "/me",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetUserProfileController()),
);
userRoutes.patch(
  "/me/password",
  ensureUserIsAuthenticated,
  adaptRoute(makeChangePasswordController()),
);
userRoutes.get(
  "/me/barbershops",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchUserBarbershopsController()),
);

export { userRoutes };
