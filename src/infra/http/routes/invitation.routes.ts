import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeAcceptInvitationController } from "../factories/make-accept-invitation-controller";
import { makeDeclineInvitationController } from "../factories/make-decline-invitation-controller";
import { makeFetchUserInvitationsController } from "../factories/make-fetch-user-invitations-controller";
import { makeAcceptInvitationByIdController } from "../factories/make-accept-invitation-by-id-controller";
import { makeDeclineInvitationByIdController } from "../factories/make-decline-invitation-by-id-controller";
import { makeGetInvitationByIdController } from "../factories/make-get-invitation-by-id-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

const invitationRoutes = Router();

// POST /invitations/accept (por token legado)
invitationRoutes.post(
  "/accept",
  ensureUserIsAuthenticated,
  adaptRoute(makeAcceptInvitationController()),
);

// POST /invitations/decline (por token legado)
invitationRoutes.post(
  "/decline",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeclineInvitationController()),
);

// GET /invitations (minha lista de convites pendentes)
invitationRoutes.get(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchUserInvitationsController()),
);

// POST /invitations/:invitationId/accept (autenticado por ID canônico)
invitationRoutes.post(
  "/:invitationId/accept",
  ensureUserIsAuthenticated,
  adaptRoute(makeAcceptInvitationByIdController()),
);

// POST /invitations/:invitationId/decline (autenticado por ID canônico)
invitationRoutes.post(
  "/:invitationId/decline",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeclineInvitationByIdController()),
);

// GET /invitations/:invitationId (detalhes do convite por ID)
invitationRoutes.get(
  "/:invitationId",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetInvitationByIdController()),
);

export { invitationRoutes };
