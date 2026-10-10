/** biome-ignore-all lint/complexity/noStaticOnlyClass: mapper class */
import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { serviceItems } from "../../../infra/drizzle/schema";
import { ServiceItem } from "../entities/service-item";

type PersistenceServiceItem = InferSelectModel<typeof serviceItems>;

export class ServiceItemMapper {
  static toDomain(raw: PersistenceServiceItem): ServiceItem {
    return ServiceItem.create(
      {
        serviceId: new UniqueEntityId(raw.serviceId),
        titleSnapshot: raw.titleSnapshot ?? undefined,
        priceInCentsSnapshot: raw.priceInCentsSnapshot ?? undefined,
        durationInMinutesSnapshot: raw.durationInMinutesSnapshot ?? undefined,
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(serviceItem: ServiceItem) {
    return {
      id: serviceItem.id.toString(),
      serviceId: serviceItem.serviceId.toString(),
      titleSnapshot: serviceItem.titleSnapshot ?? null,
      priceInCentsSnapshot: serviceItem.priceInCentsSnapshot ?? null,
      durationInMinutesSnapshot: serviceItem.durationInMinutesSnapshot ?? null,
      createdAt: serviceItem.createdAt,
    };
  }

  static toHTTP(serviceItem: ServiceItem) {
    return {
      id: serviceItem.id.toString(),
      serviceId: serviceItem.serviceId.toString(),
      titleSnapshot: serviceItem.titleSnapshot ?? null,
      priceInCentsSnapshot: serviceItem.priceInCentsSnapshot ?? null,
      durationInMinutesSnapshot: serviceItem.durationInMinutesSnapshot ?? null,
      createdAt: serviceItem.createdAt,
    };
  }
}
