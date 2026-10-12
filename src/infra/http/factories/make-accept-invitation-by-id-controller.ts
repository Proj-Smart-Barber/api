import type { Controller } from "../../../core/infra/controller";
import { RespondToInvitationUseCase } from "../../../domain/application/use-cases/invitations/respond-to-invitation/respond-to-invitation";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { AcceptInvitationByIdController } from "../controllers/invitations/accept-invitation-by-id.controller";

export function makeAcceptInvitationByIdController(): Controller {
  const useCase = new RespondToInvitationUseCase(
    new DrizzleInvitationsRepository(),
    new DrizzleUsersRepository(),
    new DrizzleMembershipsRepository(),
  );

  return new AcceptInvitationByIdController(useCase);
}
