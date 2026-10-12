import { CancelBookingUseCase } from "../../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { CancelBookingController } from "../controllers/cancel-booking-controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";

export function makeCancelBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleMembershipsRepository = new DrizzleMembershipsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();

  const cancelBookingUseCase = new CancelBookingUseCase(
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

  return new CancelBookingController(
    cancelBookingUseCase,
    drizzleBookingsRepository,
    attemptService,
  );
}
