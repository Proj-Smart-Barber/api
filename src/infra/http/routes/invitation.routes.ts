import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeAcceptInvitationController } from "../factories/make-accept-invitation-controller";
import { makeDeclineInvitationController } from "../factories/make-decline-invitation-controller";
import { makeFetchUserInvitationsController } from "../factories/make-fetch-user-invitations-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

const invitationRoutes = Router();

// POST /invitations/accept
invitationRoutes.post(
  "/accept",
  ensureUserIsAuthenticated,
  adaptRoute(makeAcceptInvitationController()),
);

// POST /invitations/decline
invitationRoutes.post(
  "/decline",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeclineInvitationController()),
);

// GET /invitations (my pending invitations)
invitationRoutes.get(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchUserInvitationsController()),
);

export { invitationRoutes };
