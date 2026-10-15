import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { ResendInvitationUseCase } from "../../../domain/application/use-cases/invitations/resend-invitation/resend-invitation";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { DrizzleBarberRegistrationsRepository } from "../../drizzle/repositories/drizzle-barber-registrations-repository";
import { ResendEmailService } from "../../email/resend-email-service";
import { ResendInvitationController } from "../controllers/invitations/resend-invitation.controller";

export function makeResendInvitationController() {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const invitationsRepository = new DrizzleInvitationsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const emailService = new ResendEmailService();
  const barberRegistrationsRepository =
    new DrizzleBarberRegistrationsRepository();

  const useCase = new ResendInvitationUseCase(
    barbershopsRepository,
    invitationsRepository,
    membershipsRepository,
    usersRepository,
    emailService,
    barberRegistrationsRepository,
  );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  return new ResendInvitationController(useCase, attemptService);
}
