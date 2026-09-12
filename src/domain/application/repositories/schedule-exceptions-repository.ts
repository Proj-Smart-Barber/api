import type { ScheduleException } from "../../enterprise/entities/schedule-exception";

export interface ScheduleExceptionsRepository {
  create(exception: ScheduleException): Promise<void>;
  findById(id: string): Promise<ScheduleException | null>;
  save(exception: ScheduleException): Promise<void>;
  findManyByBarbershopId(barbershopId: string): Promise<ScheduleException[]>;
  delete(exception: ScheduleException): Promise<void>;
}
