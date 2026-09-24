import type { ScheduleExceptionsRepository } from "@/domain/application/repositories/schedule-exceptions-repository";
import type { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";
import { db } from "../index";
import { scheduleExceptions } from "../schema";
import { eq } from "drizzle-orm";
import { DrizzleScheduleExceptionMapper } from "../mappers/drizzle-schedule-exception-mapper";

export class DrizzleScheduleExceptionsRepository
  implements ScheduleExceptionsRepository
{
  async create(exception: ScheduleException): Promise<void> {
    const data = DrizzleScheduleExceptionMapper.toDrizzle(exception);
    await db.insert(scheduleExceptions).values({
      ...data,
      createdAt: data.createdAt ?? new Date(),
    });
  }

  async save(exception: ScheduleException): Promise<void> {
    const data = DrizzleScheduleExceptionMapper.toDrizzle(exception);
    await db
      .update(scheduleExceptions)
      .set({
        ...data,
        createdAt: data.createdAt ?? new Date(),
      })
      .where(eq(scheduleExceptions.id, data.id));
  }

  async findById(id: string): Promise<ScheduleException | null> {
    const results = await db
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
  ): Promise<ScheduleException[]> {
    const exceptions = await db
      .select()
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.barbershopId, barbershopId));

    return exceptions.map(DrizzleScheduleExceptionMapper.toDomain);
  }

  async delete(exception: ScheduleException): Promise<void> {
    await db
      .delete(scheduleExceptions)
      .where(eq(scheduleExceptions.id, exception.id.toString()));
  }
}
