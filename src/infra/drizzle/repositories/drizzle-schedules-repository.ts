import type { SchedulesRepository } from "../../../domain/application/repositories/schedules-repository";
import type { BarbershopSchedule } from "../../../domain/enterprise/entities/barbershop-schedule";
import { db } from "../index";
import { barbershopSchedules, barbershops } from "../schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { DrizzleBarbershopScheduleMapper } from "../mappers/drizzle-barbershop-schedule-mapper";

import {
  drizzleTxContext,
  type DbClient,
} from "../drizzle-transaction-context";

export class DrizzleSchedulesRepository implements SchedulesRepository {
  async runWithLock<T>(
    barbershopId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return await db.transaction(async (tx) => {
      // 1. SELECT ... FOR UPDATE na tabela barbershops
      await tx
        .select()
        .from(barbershops)
        .where(eq(barbershops.id, barbershopId))
        .for("update");

      // 2. Advisory lock transacional exclusivo por barbearia
      // =========================================================================
      // NOTA ARQUITETURAL / PROTEÇÃO BILATERAL CONTRA CONDIÇÃO DE CORRIDA:
      // O advisory lock transacional (pg_advisory_xact_lock) serializa concorrentemente
      // quaisquer modificações na grade de horários da barbearia.
      // Futuros casos de uso de criação/edição de agendamentos (ex: CreateBookingUseCase)
      // DEVEM obrigatoriamente executar dentro de uma transação e adquirir o mesmo
      // advisory lock (pg_advisory_xact_lock(hashtext('barbershop_schedule:' || barbershopId)))
      // para garantir a proteção bilateral estrita contra race conditions entre novas
      // reservas concorrentes e a alteração da jornada.
      // =========================================================================
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('barbershop_schedule:' || ${barbershopId}))`,
      );

      // 3. Executa a operação compartilhando a MESMA transação através do AsyncLocalStorage
      return await drizzleTxContext.run(tx, async () => {
        return await operation();
      });
    });
  }
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
    const executeReplace = async (tx: DbClient) => {
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
    };

    const activeTx = drizzleTxContext.getStore();
    if (activeTx) {
      // Já está sob a transação atômica do runWithLock: executa diretamente na mesma transação
      await executeReplace(activeTx);
    } else {
      // Execução isolada fora do runWithLock: abre nova transação
      await db.transaction(async (tx) => {
        await executeReplace(tx);
      });
    }
  }
}
