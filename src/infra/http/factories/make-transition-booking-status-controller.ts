import { TransitionBookingStatusUseCase } from "../../../domain/application/use-cases/booking/transition-booking-status/transition-booking-status";
import { TransitionBookingStatusController } from "../controllers/booking/transition-booking-status.controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";

export function makeTransitionBookingStatusController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleMembershipsRepository = new DrizzleMembershipsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();

  const transitionBookingStatusUseCase = new TransitionBookingStatusUseCase(
    drizzleBookingsRepository,
    drizzleMembershipsRepository,
    drizzleNotificationsRepository,
    unitOfWork,
  );

  return new TransitionBookingStatusController(
    transitionBookingStatusUseCase,
    drizzleBookingsRepository,
  );
}
