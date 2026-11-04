import type { EmailService } from "../../../domain/application/services/email-service";
import { InvitationDeliveryService } from "../../../domain/application/services/invitation-delivery-service";
import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { CreateBarberRegistrationUseCase } from "../../../domain/application/use-cases/barbershop/create-barber-registration/create-barber-registration";
import type { InvitationDeliveriesRepository } from "../../../domain/application/repositories/invitation-deliveries-repository";
import { DrizzleBarberRegistrationsRepository } from "../../drizzle/repositories/drizzle-barber-registrations-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationDeliveriesRepository } from "../../drizzle/repositories/drizzle-invitation-deliveries-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { ResendEmailService } from "../../email/resend-email-service";
import { CreateBarberRegistrationController } from "../controllers/barbershop/create-barber-registration.controller";

export interface MakeCreateBarberRegistrationControllerOverrides {
  emailService?: EmailService;
  deliveriesRepository?: InvitationDeliveriesRepository;
  deliveryService?: InvitationDeliveryService;
}

export function makeCreateBarberRegistrationController(
  overrides?: MakeCreateBarberRegistrationControllerOverrides,
) {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const invitationsRepository = new DrizzleInvitationsRepository();
  const barberRegistrationsRepository =
    new DrizzleBarberRegistrationsRepository();
  const emailService = overrides?.emailService ?? new ResendEmailService();
  const notificationsRepository = new DrizzleNotificationsRepository();
  const deliveriesRepository =
    overrides?.deliveriesRepository ??
    new DrizzleInvitationDeliveriesRepository();

  const useCase = new CreateBarberRegistrationUseCase(
    barbershopsRepository,
    membershipsRepository,
    usersRepository,
    invitationsRepository,
    barberRegistrationsRepository,
    emailService,
    notificationsRepository,
    deliveriesRepository,
  );

  const deliveryService =
    overrides?.deliveryService ??
    new InvitationDeliveryService(
      deliveriesRepository,
      invitationsRepository,
      emailService,
    );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  return new CreateBarberRegistrationController(
    useCase,
    attemptService,
    deliveryService,
  );
}
