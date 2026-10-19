import type { ScheduleExceptionsRepository } from "../../../domain/application/repositories/schedule-exceptions-repository";
import type { ScheduleException } from "../../../domain/enterprise/entities/schedule-exception";
import { db } from "../index";
import { scheduleExceptions } from "../schema";
import { eq } from "drizzle-orm";
import { DrizzleScheduleExceptionMapper } from "../mappers/drizzle-schedule-exception-mapper";

export class DrizzleScheduleExceptionsRepository
  implements ScheduleExceptionsRepository
{
  async create(exception: ScheduleException, tx?: any): Promise<void> {
    const client = tx ?? db;
    const data = DrizzleScheduleExceptionMapper.toDrizzle(exception);
    await client.insert(scheduleExceptions).values({
      ...data,
      createdAt: data.createdAt ?? new Date(),
    });
  }

  async save(exception: ScheduleException, tx?: any): Promise<void> {
    const client = tx ?? db;
    const data = DrizzleScheduleExceptionMapper.toDrizzle(exception);
    await client
      .update(scheduleExceptions)
      .set({
        ...data,
        createdAt: data.createdAt ?? new Date(),
      })
      .where(eq(scheduleExceptions.id, data.id));
  }

  async findById(id: string, tx?: any): Promise<ScheduleException | null> {
    const client = tx ?? db;
    const results = await client
      .select()
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.id, id));

    const exception = results[0];

    if (!exception) {
      return null;
    }

    return DrizzleScheduleExceptionMapper.toDomain(exception);
  }

  async findManyByBarbershopId(
    barbershopId: string,
    tx?: any,
  ): Promise<ScheduleException[]> {
    const client = tx ?? db;
    const exceptions = await client
      .select()
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.barbershopId, barbershopId));

    return exceptions.map(DrizzleScheduleExceptionMapper.toDomain);
  }

  async delete(exception: ScheduleException, tx?: any): Promise<void> {
    const client = tx ?? db;
    await client
      .delete(scheduleExceptions)
      .where(eq(scheduleExceptions.id, exception.id.toString()));
  }
}
