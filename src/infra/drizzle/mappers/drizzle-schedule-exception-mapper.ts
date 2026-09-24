import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { ScheduleException } from "../../../domain/enterprise/entities/schedule-exception";
import type { scheduleExceptions } from "../schema";
import type { InferSelectModel } from "drizzle-orm";

type RawScheduleException = InferSelectModel<typeof scheduleExceptions>;

export class DrizzleScheduleExceptionMapper {
  static toDomain(raw: RawScheduleException): ScheduleException {
    return ScheduleException.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        barbermanId: raw.barbermanId
          ? new UniqueEntityId(raw.barbermanId)
          : null,
        date: raw.date,
        startTime: raw.startTime ?? null,
        endTime: raw.endTime ?? null,
        reason: raw.reason ?? null,
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(exception: ScheduleException) {
    return {
      id: exception.id.toString(),
      barbershopId: exception.barbershopId.toString(),
      barbermanId: exception.barbermanId?.toString() ?? null,
      date: exception.date,
      startTime: exception.startTime ?? null,
      endTime: exception.endTime ?? null,
      reason: exception.reason ?? null,
      createdAt: exception.createdAt,
    };
  }
}
