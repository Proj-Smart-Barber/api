import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Service } from "../../../domain/enterprise/entities/service";
import type { services } from "../schema";
import type { InferSelectModel } from "drizzle-orm";

type RawService = InferSelectModel<typeof services>;

export class DrizzleServiceMapper {
  static toDomain(raw: RawService): Service {
    return Service.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        title: raw.title,
        description: raw.description ?? undefined,
        priceInCents: raw.priceInCents,
        durationInMinutes: raw.durationInMinutes,
        isActive: raw.isActive,
        createdAt: raw.createdAt ?? undefined,
        updatedAt: raw.updatedAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(service: Service) {
    return {
      id: service.id.toString(),
      barbershopId: service.barbershopId.toString(),
      title: service.title,
      description: service.description ?? null,
      priceInCents: service.priceInCents,
      durationInMinutes: service.durationInMinutes,
      isActive: service.isActive,
      createdAt: service.createdAt ?? new Date(),
      updatedAt: service.updatedAt ?? new Date(),
    };
  }
}
