/** biome-ignore-all lint/complexity/noStaticOnlyClass: mapper class */
import type { ServiceItem } from "../entities/service-item";

export class ServiceItemMapper {
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
}
