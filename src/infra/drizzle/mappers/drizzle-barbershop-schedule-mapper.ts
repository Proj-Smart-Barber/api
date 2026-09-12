import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { BarbershopSchedule } from "@/domain/enterprise/entities/barbershop-schedule";
import type { barbershopSchedules } from "../schema";
import type { InferSelectModel } from "drizzle-orm";

type RawBarbershopSchedule = InferSelectModel<typeof barbershopSchedules>;

export class DrizzleBarbershopScheduleMapper {
  static toDomain(raw: RawBarbershopSchedule): BarbershopSchedule {
    return BarbershopSchedule.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        createdBy: new UniqueEntityId(raw.createdBy),
        barbermanId: raw.barbermanId
          ? new UniqueEntityId(raw.barbermanId)
          : null,
        dayOfWeek: raw.dayOfWeek,
        openTime: raw.openTime,
        closeTime: raw.closeTime,
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(schedule: BarbershopSchedule) {
    return {
      id: schedule.id.toString(),
      barbershopId: schedule.barbershopId.toString(),
      createdBy: schedule.createdBy.toString(),
      barbermanId: schedule.barbermanId?.toString() ?? null,
      dayOfWeek: schedule.dayOfWeek,
      openTime: schedule.openTime,
      closeTime: schedule.closeTime,
      createdAt: schedule.createdAt,
    };
  }
}
