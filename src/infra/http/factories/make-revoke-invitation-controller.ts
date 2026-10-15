import type { Controller } from "../../../core/infra/controller";
import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { RevokeInvitationUseCase } from "../../../domain/application/use-cases/invitations/revoke-invitation/revoke-invitation";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { RevokeInvitationController } from "../controllers/invitations/revoke-invitation.controller";

export function makeRevokeInvitationController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const invitationsRepository = new DrizzleInvitationsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();

  const revokeInvitationUseCase = new RevokeInvitationUseCase(
    barbershopsRepository,
    invitationsRepository,
    membershipsRepository,
  );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  return new RevokeInvitationController(revokeInvitationUseCase, attemptService);
}
