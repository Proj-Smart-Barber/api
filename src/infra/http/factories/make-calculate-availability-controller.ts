import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { InMemoryBookingsRepository } from "../../../../test/repositories/in-memory-bookings-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { CalculateAvailabilityUseCase } from "@/domain/application/use-cases/schedule/calculate-availability/calculate-availability";
import { CalculateAvailabilityController } from "../controllers/schedule/calculate-availability.controller";

export function makeCalculateAvailabilityController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const bookingsRepository = new InMemoryBookingsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();

  const calculateAvailabilityUseCase = new CalculateAvailabilityUseCase(
    schedulesRepository,
    scheduleExceptionsRepository,
    servicesRepository,
    bookingsRepository,
    barbershopsRepository,
  );

  return new CalculateAvailabilityController(calculateAvailabilityUseCase);
}
