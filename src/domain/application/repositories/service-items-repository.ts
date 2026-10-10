import type { ServiceItem } from "../../enterprise/entities/service-item";

export interface ServiceItemsRepository {
  create(serviceItem: ServiceItem): Promise<void>;
  findById(id: string): Promise<ServiceItem | null>;
  deleteById(id: string): Promise<void>;
}
