import { RescheduleBookingUseCase } from "../../../domain/application/use-cases/booking/reschedule-booking/reschedule-booking";
import { RescheduleBookingController } from "../controllers/booking/reschedule-booking.controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";

export function makeRescheduleBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleServicesRepository = new DrizzleServicesRepository();
  const drizzleMembershipsRepository = new DrizzleMembershipsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();

  const rescheduleBookingUseCase = new RescheduleBookingUseCase(
    drizzleBookingsRepository,
    drizzleServicesRepository,
    drizzleMembershipsRepository,
    drizzleNotificationsRepository,
    unitOfWork,
  );

  return new RescheduleBookingController(
    rescheduleBookingUseCase,
    drizzleBookingsRepository,
  );
}
