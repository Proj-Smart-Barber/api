import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { InMemoryBookingsRepository } from "../../../../test/repositories/in-memory-bookings-repository";
import { CalculateAvailabilityUseCase } from "@/domain/application/use-cases/schedule/calculate-availability/calculate-availability";
import { CalculateAvailabilityController } from "../controllers/schedule/calculate-availability.controller";

export function makeCalculateAvailabilityController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const bookingsRepository = new InMemoryBookingsRepository();

  const calculateAvailabilityUseCase = new CalculateAvailabilityUseCase(
    schedulesRepository,
    scheduleExceptionsRepository,
    servicesRepository,
    bookingsRepository,
  );

  return new CalculateAvailabilityController(calculateAvailabilityUseCase);
}
