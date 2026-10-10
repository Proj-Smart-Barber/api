import type { Controller } from "../../../core/infra/controller";
import { RevokeInvitationUseCase } from "../../../domain/application/use-cases/invitations/revoke-invitation/revoke-invitation";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { RevokeInvitationController } from "../controllers/invitations/revoke-invitation.controller";

export function makeRevokeInvitationController(): Controller {
  const revokeInvitationUseCase = new RevokeInvitationUseCase(
    new DrizzleBarbershopsRepository(),
    new DrizzleInvitationsRepository(),
  );

  return new RevokeInvitationController(revokeInvitationUseCase);
}
