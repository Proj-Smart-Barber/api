import { InMemorySchedulesRepository } from "../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryScheduleExceptionsRepository } from "../../../../test/repositories/in-memory-schedule-exceptions-repository";
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

// Instâncias "em memória" persistentes para que os mocks funcionem através de requisições contínuas
const schedulesRepository = new InMemorySchedulesRepository();
const scheduleExceptionsRepository = new InMemoryScheduleExceptionsRepository();

// Mock do ServicesRepository apenas para o teste passar
class InMemoryServicesRepository implements ServicesRepository {
  async findById(id: string): Promise<Service | null> {
    return null;
  }
  async findManyByIds(ids: string[]): Promise<Service[]> {
    // Retornamos um stub de duração 30 min por serviço solicitado para mockar
    return ids.map(
      (id) => ({ id, durationInMinutes: 30 }) as unknown as Service,
    );
  }
}
const servicesRepository = new InMemoryServicesRepository();

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
