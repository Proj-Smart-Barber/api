import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { CreateBookingUseCase } from "../../../domain/application/use-cases/booking/create-booking/create-booking";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { CreateBookingController } from "../controllers/create-booking-controller";

export function makeCreateBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleServicesRepository = new DrizzleServicesRepository();
  const drizzleMembershipsRepository = new DrizzleMembershipsRepository();
  const drizzleUsersRepository = new DrizzleUsersRepository();
  const drizzleBarbershopsRepository = new DrizzleBarbershopsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();

  const createBookingUseCase = new CreateBookingUseCase(
    drizzleBookingsRepository,
    drizzleServicesRepository,
    drizzleMembershipsRepository,
    drizzleUsersRepository,
    drizzleBarbershopsRepository,
    drizzleNotificationsRepository,
    unitOfWork,
  );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  return new CreateBookingController(
    createBookingUseCase,
    attemptService,
    drizzleBookingsRepository,
    drizzleServicesRepository,
  );
}
