import { DrizzleSchedulesRepository } from "../../drizzle/repositories/drizzle-schedules-repository";
import { DrizzleScheduleExceptionsRepository } from "../../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import type { ServicesRepository } from "@/domain/application/repositories/services-repository";
import type { Service } from "@/domain/enterprise/entities/service";
import { UpdateBarbershopScheduleUseCase } from "@/domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { CreateScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/create-schedule-exception/create-schedule-exception";
import { DeleteScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/delete-schedule-exception/delete-schedule-exception";
import { CalculateAvailabilityUseCase } from "@/domain/application/use-cases/schedule/calculate-availability/calculate-availability";
import { UpdateBarbershopScheduleController } from "../controllers/schedule/update-barbershop-schedule.controller";
import { CreateScheduleExceptionController } from "../controllers/schedule/create-schedule-exception.controller";
import { DeleteScheduleExceptionController } from "../controllers/schedule/delete-schedule-exception.controller";
import { CalculateAvailabilityController } from "../controllers/schedule/calculate-availability.controller";

// Instâncias para uso global na API HTTP
const schedulesRepository = new DrizzleSchedulesRepository();
const scheduleExceptionsRepository = new DrizzleScheduleExceptionsRepository();
const servicesRepository = new DrizzleServicesRepository();

// Casos de Uso
const updateBarbershopScheduleUseCase = new UpdateBarbershopScheduleUseCase(
  schedulesRepository,
);
const createScheduleExceptionUseCase = new CreateScheduleExceptionUseCase(
  scheduleExceptionsRepository,
);
const deleteScheduleExceptionUseCase = new DeleteScheduleExceptionUseCase(
  scheduleExceptionsRepository,
);
const calculateAvailabilityUseCase = new CalculateAvailabilityUseCase(
  schedulesRepository,
  scheduleExceptionsRepository,
  servicesRepository,
);

// Controllers
export const updateBarbershopScheduleController =
  new UpdateBarbershopScheduleController(updateBarbershopScheduleUseCase);
export const createScheduleExceptionController =
  new CreateScheduleExceptionController(createScheduleExceptionUseCase);
export const deleteScheduleExceptionController =
  new DeleteScheduleExceptionController(deleteScheduleExceptionUseCase);
export const calculateAvailabilityController =
  new CalculateAvailabilityController(calculateAvailabilityUseCase);
