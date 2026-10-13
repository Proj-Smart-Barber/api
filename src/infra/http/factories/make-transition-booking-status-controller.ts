import { TransitionBookingStatusUseCase } from "../../../domain/application/use-cases/booking/transition-booking-status/transition-booking-status";
import { TransitionBookingStatusController } from "../controllers/booking/transition-booking-status.controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";

export function makeTransitionBookingStatusController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleMembershipsRepository = new DrizzleMembershipsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();

  const transitionBookingStatusUseCase = new TransitionBookingStatusUseCase(
    drizzleBookingsRepository,
    drizzleMembershipsRepository,
    drizzleNotificationsRepository,
    unitOfWork,
  );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  return new TransitionBookingStatusController(
    transitionBookingStatusUseCase,
    drizzleBookingsRepository,
    attemptService,
  );
}
