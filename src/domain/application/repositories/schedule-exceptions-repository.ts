import type { ScheduleException } from "../../enterprise/entities/schedule-exception";

export interface ScheduleExceptionsRepository {
  create(exception: ScheduleException, tx?: any): Promise<void>;
  findById(id: string, tx?: any): Promise<ScheduleException | null>;
  save(exception: ScheduleException, tx?: any): Promise<void>;
  findManyByBarbershopId(
    barbershopId: string,
    tx?: any,
  ): Promise<ScheduleException[]>;
  delete(exception: ScheduleException, tx?: any): Promise<void>;
}
