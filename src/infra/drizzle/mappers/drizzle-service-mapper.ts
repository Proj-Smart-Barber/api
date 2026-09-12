import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { Service } from "@/domain/enterprise/entities/service";
import type { services } from "../schema";
import type { InferSelectModel } from "drizzle-orm";

type RawService = InferSelectModel<typeof services>;

export class DrizzleServiceMapper {
  static toDomain(raw: RawService): Service {
    return Service.create(
      {
        title: raw.title,
        description: raw.description ?? undefined,
        priceInCents: raw.priceInCents,
        durationInMinutes: raw.durationInMinutes,
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }
}
