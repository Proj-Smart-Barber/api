import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import {
  BarbershopScheduleScope,
  type ScheduleScopeState,
} from "../../../domain/enterprise/entities/barbershop-schedule-scope";
import type { barbershopScheduleScopes } from "../schema";
import type { InferSelectModel } from "drizzle-orm";

type RawBarbershopScheduleScope = InferSelectModel<
  typeof barbershopScheduleScopes
>;

export class DrizzleBarbershopScheduleScopeMapper {
  static toDomain(raw: RawBarbershopScheduleScope): BarbershopScheduleScope {
    return BarbershopScheduleScope.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        barbermanId: raw.barbermanId
          ? new UniqueEntityId(raw.barbermanId)
          : null,
        state: raw.state as ScheduleScopeState,
        version: raw.version,
        lastMutationId: raw.lastMutationId,
        lastMutationHash: raw.lastMutationHash,
        createdAt: raw.createdAt ?? new Date(),
        updatedAt: raw.updatedAt ?? new Date(),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(scope: BarbershopScheduleScope) {
    return {
      id: scope.id.toString(),
      barbershopId: scope.barbershopId.toString(),
      barbermanId: scope.barbermanId?.toString() ?? null,
      state: scope.state,
      version: scope.version,
      lastMutationId: scope.lastMutationId,
      lastMutationHash: scope.lastMutationHash,
      createdAt: scope.createdAt,
      updatedAt: scope.updatedAt,
    };
  }
}
