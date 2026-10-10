import type { Controller } from "../../../core/infra/controller";
import { DeclineInvitationUseCase } from "../../../domain/application/use-cases/invitations/decline-invitation/decline-invitation";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DeclineInvitationController } from "../controllers/invitations/decline-invitation.controller";

export function makeDeclineInvitationController(): Controller {
  const declineInvitationUseCase = new DeclineInvitationUseCase(
    new DrizzleInvitationsRepository(),
    new DrizzleUsersRepository(),
  );

  return new DeclineInvitationController(declineInvitationUseCase);
}
