import type { ServiceItemsRepository } from "../../src/domain/application/repositories/service-items-repository";
import type { ServiceItem } from "../../src/domain/enterprise/entities/service-item";

export class InMemoryServiceItemsRepository implements ServiceItemsRepository {
  public items: ServiceItem[] = [];

  async create(serviceItem: ServiceItem): Promise<void> {
    this.items.push(serviceItem);
  }

  async findById(id: string): Promise<ServiceItem | null> {
    const serviceItem = this.items.find((item) => item.id.toString() === id);

    return serviceItem ?? null;
  }

  async deleteById(id: string): Promise<void> {
    const itemIndex = this.items.findIndex((item) => item.id.toString() === id);

    if (itemIndex >= 0) {
      this.items.splice(itemIndex, 1);
    }
  }
}
