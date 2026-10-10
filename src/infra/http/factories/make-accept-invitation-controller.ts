import type { Controller } from "../../../core/infra/controller";
import { AcceptInvitationUseCase } from "../../../domain/application/use-cases/invitations/accept-invitation/accept-invitation";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { AcceptInvitationController } from "../controllers/invitations/accept-invitation.controller";

export function makeAcceptInvitationController(): Controller {
  const acceptInvitationUseCase = new AcceptInvitationUseCase(
    new DrizzleInvitationsRepository(),
    new DrizzleUsersRepository(),
    new DrizzleMembershipsRepository(),
  );

  return new AcceptInvitationController(acceptInvitationUseCase);
}
