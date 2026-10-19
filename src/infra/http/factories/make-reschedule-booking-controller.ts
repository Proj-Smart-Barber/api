import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { RescheduleBookingUseCase } from "../../../domain/application/use-cases/booking/reschedule-booking/reschedule-booking";
import { RescheduleBookingController } from "../controllers/booking/reschedule-booking.controller";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleResourceAccessValidator } from "../../drizzle/services/drizzle-resource-access-validator";
import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";

import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";

export function makeRescheduleBookingController() {
  const drizzleBookingsRepository = new DrizzleBookingsRepository();
  const drizzleServicesRepository = new DrizzleServicesRepository();
  const drizzleMembershipsRepository = new DrizzleMembershipsRepository();
  const drizzleNotificationsRepository = new DrizzleNotificationsRepository();
  const drizzleSchedulesRepository = new DrizzleSchedulesRepository();
  const drizzleScheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const accessValidator = new DrizzleResourceAccessValidator();

  const rescheduleBookingUseCase = new RescheduleBookingUseCase(
    drizzleBookingsRepository,
    drizzleServicesRepository,
    drizzleMembershipsRepository,
    drizzleNotificationsRepository,
    unitOfWork,
    new DrizzleBarbershopsRepository(),
    drizzleSchedulesRepository,
    drizzleScheduleExceptionsRepository,
  );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
    accessValidator,
  );

  return new RescheduleBookingController(
    rescheduleBookingUseCase,
    drizzleBookingsRepository,
    attemptService,
  );
}
