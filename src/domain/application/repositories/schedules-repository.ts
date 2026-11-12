import type { BarbershopSchedule } from "../../enterprise/entities/barbershop-schedule";
import type { BarbershopScheduleScope } from "../../enterprise/entities/barbershop-schedule-scope";

export interface SchedulesRepository {
  create(schedule: BarbershopSchedule, tx?: any): Promise<void>;
  save(schedule: BarbershopSchedule, tx?: any): Promise<void>;
  findById(id: string, tx?: any): Promise<BarbershopSchedule | null>;
  findManyByBarbershopId(
    barbershopId: string,
    tx?: any,
  ): Promise<BarbershopSchedule[]>;
  findManyByBarbershopAndDay?(
    barbershopId: string,
    dayOfWeek: string,
    barbermanId?: string | null,
    tx?: any,
  ): Promise<BarbershopSchedule[]>;
  findScopesForBarbershop?(
    barbershopId: string,
    barbermanId?: string | null,
    tx?: any,
  ): Promise<{
    generalScope: BarbershopScheduleScope | null;
    barberScope: BarbershopScheduleScope | null;
  }>;
  delete(schedule: BarbershopSchedule, tx?: any): Promise<void>;
  bulkReplace(
    barbershopId: string,
    barbermanId: string | null,
    schedules: BarbershopSchedule[],
    tx?: any,
  ): Promise<void>;
  findScope(
    barbershopId: string,
    barbermanId: string | null,
    tx?: any,
  ): Promise<BarbershopScheduleScope | null>;
  saveScope(scope: BarbershopScheduleScope, tx?: any): Promise<void>;
}
