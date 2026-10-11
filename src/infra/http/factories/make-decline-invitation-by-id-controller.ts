import type { Controller } from "../../../core/infra/controller";
import { RespondToInvitationUseCase } from "../../../domain/application/use-cases/invitations/respond-to-invitation/respond-to-invitation";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DeclineInvitationByIdController } from "../controllers/invitations/decline-invitation-by-id.controller";

export function makeDeclineInvitationByIdController(): Controller {
  const useCase = new RespondToInvitationUseCase(
    new DrizzleInvitationsRepository(),
    new DrizzleUsersRepository(),
    new DrizzleMembershipsRepository(),
  );

  return new DeclineInvitationByIdController(useCase);
}
