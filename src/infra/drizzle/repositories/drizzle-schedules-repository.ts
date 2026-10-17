import type { SchedulesRepository } from "../../../domain/application/repositories/schedules-repository";
import type { BarbershopSchedule } from "../../../domain/enterprise/entities/barbershop-schedule";
import type { BarbershopScheduleScope } from "../../../domain/enterprise/entities/barbershop-schedule-scope";
import { db } from "../index";
import { barbershopSchedules, barbershopScheduleScopes } from "../schema";
import { eq, and, isNull } from "drizzle-orm";
import { DrizzleBarbershopScheduleMapper } from "../mappers/drizzle-barbershop-schedule-mapper";
import { DrizzleBarbershopScheduleScopeMapper } from "../mappers/drizzle-barbershop-schedule-scope-mapper";

export class DrizzleSchedulesRepository implements SchedulesRepository {
  async create(schedule: BarbershopSchedule, tx?: any): Promise<void> {
    const client = tx ?? db;
    const data = DrizzleBarbershopScheduleMapper.toDrizzle(schedule);
    await client.insert(barbershopSchedules).values({
      ...data,
      createdAt: data.createdAt ?? new Date(),
    });
  }

  async save(schedule: BarbershopSchedule, tx?: any): Promise<void> {
    const client = tx ?? db;
    const data = DrizzleBarbershopScheduleMapper.toDrizzle(schedule);
    await client
      .update(barbershopSchedules)
      .set({
        ...data,
        createdAt: data.createdAt ?? new Date(),
      })
      .where(eq(barbershopSchedules.id, data.id));
  }

  async findById(id: string, tx?: any): Promise<BarbershopSchedule | null> {
    const client = tx ?? db;
    const results = await client
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
    tx?: any,
  ): Promise<BarbershopSchedule[]> {
    const client = tx ?? db;
    const schedules = await client
      .select()
      .from(barbershopSchedules)
      .where(eq(barbershopSchedules.barbershopId, barbershopId));

    return schedules.map(DrizzleBarbershopScheduleMapper.toDomain);
  }

  async delete(schedule: BarbershopSchedule, tx?: any): Promise<void> {
    const client = tx ?? db;
    await client
      .delete(barbershopSchedules)
      .where(eq(barbershopSchedules.id, schedule.id.toString()));
  }

  async bulkReplace(
    barbershopId: string,
    barbermanId: string | null,
    schedules: BarbershopSchedule[],
    tx?: any,
  ): Promise<void> {
    const runInClient = async (client: any) => {
      if (barbermanId) {
        await client
          .delete(barbershopSchedules)
          .where(
            and(
              eq(barbershopSchedules.barbershopId, barbershopId),
              eq(barbershopSchedules.barbermanId, barbermanId),
            ),
          );
      } else {
        await client
          .delete(barbershopSchedules)
          .where(
            and(
              eq(barbershopSchedules.barbershopId, barbershopId),
              isNull(barbershopSchedules.barbermanId),
            ),
          );
      }

      if (schedules.length > 0) {
        const dataToInsert = schedules.map((schedule) => {
          const data = DrizzleBarbershopScheduleMapper.toDrizzle(schedule);
          return {
            ...data,
            createdAt: data.createdAt ?? new Date(),
          };
        });

        await client.insert(barbershopSchedules).values(dataToInsert);
      }
    };

    if (tx) {
      await runInClient(tx);
    } else {
      await db.transaction(async (innerTx) => {
        await runInClient(innerTx);
      });
    }
  }

  async findScope(
    barbershopId: string,
    barbermanId: string | null,
    tx?: any,
  ): Promise<BarbershopScheduleScope | null> {
    const client = tx ?? db;
    const condition = barbermanId
      ? and(
          eq(barbershopScheduleScopes.barbershopId, barbershopId),
          eq(barbershopScheduleScopes.barbermanId, barbermanId),
        )
      : and(
          eq(barbershopScheduleScopes.barbershopId, barbershopId),
          isNull(barbershopScheduleScopes.barbermanId),
        );

    const [scope] = await client
      .select()
      .from(barbershopScheduleScopes)
      .where(condition);

    if (!scope) {
      return null;
    }

    return DrizzleBarbershopScheduleScopeMapper.toDomain(scope);
  }

  async saveScope(scope: BarbershopScheduleScope, tx?: any): Promise<void> {
    const client = tx ?? db;
    const data = DrizzleBarbershopScheduleScopeMapper.toDrizzle(scope);

    const condition = scope.barbermanId
      ? and(
          eq(
            barbershopScheduleScopes.barbershopId,
            scope.barbershopId.toString(),
          ),
          eq(
            barbershopScheduleScopes.barbermanId,
            scope.barbermanId.toString(),
          ),
        )
      : and(
          eq(
            barbershopScheduleScopes.barbershopId,
            scope.barbershopId.toString(),
          ),
          isNull(barbershopScheduleScopes.barbermanId),
        );

    const [existing] = await client
      .select({ id: barbershopScheduleScopes.id })
      .from(barbershopScheduleScopes)
      .where(condition);

    if (existing) {
      await client
        .update(barbershopScheduleScopes)
        .set({
          state: data.state as any,
          version: data.version,
          lastMutationId: data.lastMutationId,
          lastMutationHash: data.lastMutationHash,
          updatedAt: new Date(),
        })
        .where(eq(barbershopScheduleScopes.id, existing.id));
    } else {
      await client.insert(barbershopScheduleScopes).values({
        id: data.id,
        barbershopId: data.barbershopId,
        barbermanId: data.barbermanId,
        state: data.state as any,
        version: data.version,
        lastMutationId: data.lastMutationId,
        lastMutationHash: data.lastMutationHash,
        createdAt: data.createdAt ?? new Date(),
        updatedAt: data.updatedAt ?? new Date(),
      });
    }
  }
}
