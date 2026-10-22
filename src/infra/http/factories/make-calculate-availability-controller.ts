import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { CalculateAvailabilityUseCase } from "../../../domain/application/use-cases/schedule/calculate-availability/calculate-availability";
import { CalculateAvailabilityController } from "../controllers/schedule/calculate-availability.controller";
import { sql } from "drizzle-orm";
import { db } from "../../drizzle";

export function makeCalculateAvailabilityController() {
  const schedulesRepository = new DrizzleSchedulesRepository();
  const scheduleExceptionsRepository =
    new DrizzleScheduleExceptionsRepository();
  const servicesRepository = new DrizzleServicesRepository();
  const bookingsRepository = new DrizzleBookingsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();

  const calculateAvailabilityUseCase = new CalculateAvailabilityUseCase(
    schedulesRepository,
    scheduleExceptionsRepository,
    servicesRepository,
    bookingsRepository,
    barbershopsRepository,
    async () => {
      const result = await db.execute(
        sql`SELECT clock_timestamp() AS server_time`,
      );
      const now = new Date(result.rows[0]?.server_time as string);
      if (!Number.isFinite(now.getTime()))
        throw new Error("DATABASE_CLOCK_UNAVAILABLE");
      return now;
    },
  );

  return new CalculateAvailabilityController(calculateAvailabilityUseCase);
}
