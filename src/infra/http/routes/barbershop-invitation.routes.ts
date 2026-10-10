import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeFetchBarbershopInvitationsController } from "../factories/make-fetch-barbershop-invitations-controller";
import { makeInviteBarbermanController } from "../factories/make-invite-barberman-controller";
import { makeRevokeInvitationController } from "../factories/make-revoke-invitation-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";

const barbershopInvitationRoutes = Router({ mergeParams: true });

// POST /barbershops/:shopId/invitations
barbershopInvitationRoutes.post(
  "/invitations",
  ensureUserIsAuthenticated,
  adaptRoute(makeInviteBarbermanController()),
);

// GET /barbershops/:shopId/invitations
barbershopInvitationRoutes.get(
  "/invitations",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchBarbershopInvitationsController()),
);

// DELETE /barbershops/:shopId/invitations/:invitationId
barbershopInvitationRoutes.delete(
  "/invitations/:invitationId",
  ensureUserIsAuthenticated,
  adaptRoute(makeRevokeInvitationController()),
);

export { barbershopInvitationRoutes };
