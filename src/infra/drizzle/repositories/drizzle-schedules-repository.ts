import type { SchedulesRepository } from "@/domain/application/repositories/schedules-repository";
import type { BarbershopSchedule } from "@/domain/enterprise/entities/barbershop-schedule";
import { db } from "../index";
import { barbershopSchedules } from "../schema";
import { eq, and, isNull } from "drizzle-orm";
import { DrizzleBarbershopScheduleMapper } from "../mappers/drizzle-barbershop-schedule-mapper";

export class DrizzleSchedulesRepository implements SchedulesRepository {
  async create(schedule: BarbershopSchedule): Promise<void> {
    const data = DrizzleBarbershopScheduleMapper.toDrizzle(schedule);
    await db.insert(barbershopSchedules).values({
      ...data,
      createdAt: data.createdAt ?? new Date(),
    });
  }

  async save(schedule: BarbershopSchedule): Promise<void> {
    const data = DrizzleBarbershopScheduleMapper.toDrizzle(schedule);
    await db
      .update(barbershopSchedules)
      .set({
        ...data,
        createdAt: data.createdAt ?? new Date(),
      })
      .where(eq(barbershopSchedules.id, data.id));
  }

  async findById(id: string): Promise<BarbershopSchedule | null> {
    const results = await db
      .select()
      .from(barbershopSchedules)
      .where(eq(barbershopSchedules.id, id));

    const schedule = results[0];

    if (!schedule) {
      return null;
    }

    return DrizzleBarbershopScheduleMapper.toDomain(schedule);
  }

  async findManyByBarbershopId(
    barbershopId: string,
  ): Promise<BarbershopSchedule[]> {
    const schedules = await db
      .select()
      .from(barbershopSchedules)
      .where(eq(barbershopSchedules.barbershopId, barbershopId));

    return schedules.map(DrizzleBarbershopScheduleMapper.toDomain);
  }

  async delete(schedule: BarbershopSchedule): Promise<void> {
    await db
      .delete(barbershopSchedules)
      .where(eq(barbershopSchedules.id, schedule.id.toString()));
  }

  async bulkReplace(
    barbershopId: string,
    barbermanId: string | null,
    schedules: BarbershopSchedule[],
  ): Promise<void> {
    // Utilizamos uma transação para garantir atomicidade. Se a inserção falhar, o delete é revertido (rollback).
    await db.transaction(async (tx) => {
      // 1. Apaga os horários antigos desta barbearia no escopo (geral ou específico)
      if (barbermanId) {
        await tx
          .delete(barbershopSchedules)
          .where(
            and(
              eq(barbershopSchedules.barbershopId, barbershopId),
              eq(barbershopSchedules.barbermanId, barbermanId),
            ),
          );
      } else {
        await tx
          .delete(barbershopSchedules)
          .where(
            and(
              eq(barbershopSchedules.barbershopId, barbershopId),
              isNull(barbershopSchedules.barbermanId),
            ),
          );
      }

      // 2. Insere os novos horários
      if (schedules.length > 0) {
        const dataToInsert = schedules.map((schedule) => {
          const data = DrizzleBarbershopScheduleMapper.toDrizzle(schedule);
          return {
            ...data,
            createdAt: data.createdAt ?? new Date(),
          };
        });

        await tx.insert(barbershopSchedules).values(dataToInsert);
      }
    });
  }
}
