import type { BarbershopSchedule } from "../../enterprise/entities/barbershop-schedule";

export interface SchedulesRepository {
  create(schedule: BarbershopSchedule): Promise<void>;
  save(schedule: BarbershopSchedule): Promise<void>;
  findById(id: string): Promise<BarbershopSchedule | null>;
  findManyByBarbershopId(barbershopId: string): Promise<BarbershopSchedule[]>;
  delete(schedule: BarbershopSchedule): Promise<void>;
  bulkReplace(
    barbershopId: string,
    schedules: BarbershopSchedule[],
  ): Promise<void>;
}
