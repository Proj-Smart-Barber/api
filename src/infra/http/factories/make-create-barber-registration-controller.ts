import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { CreateBarberRegistrationUseCase } from "../../../domain/application/use-cases/barbershop/create-barber-registration/create-barber-registration";
import { DrizzleBarberRegistrationsRepository } from "../../drizzle/repositories/drizzle-barber-registrations-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { ResendEmailService } from "../../email/resend-email-service";
import { CreateBarberRegistrationController } from "../controllers/barbershop/create-barber-registration.controller";

export function makeCreateBarberRegistrationController() {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const invitationsRepository = new DrizzleInvitationsRepository();
  const barberRegistrationsRepository =
    new DrizzleBarberRegistrationsRepository();
  const emailService = new ResendEmailService();
  const notificationsRepository = new DrizzleNotificationsRepository();

  const useCase = new CreateBarberRegistrationUseCase(
    barbershopsRepository,
    membershipsRepository,
    usersRepository,
    invitationsRepository,
    barberRegistrationsRepository,
    emailService,
    notificationsRepository,
  );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  return new CreateBarberRegistrationController(useCase, attemptService);
}
