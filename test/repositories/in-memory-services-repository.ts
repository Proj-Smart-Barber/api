import type { ServicesRepository } from "../../src/domain/application/repositories/services-repository";
import type { Service } from "../../src/domain/enterprise/entities/service";

export class InMemoryServicesRepository implements ServicesRepository {
  public items: Service[] = [];

  async findById(id: string): Promise<Service | null> {
    const service = this.items.find((item) => item.id.toString() === id);

    if (!service) {
      return null;
    }

    return service;
  }

  async findManyByIds(ids: string[]): Promise<Service[]> {
    return this.items.filter((item) => ids.includes(item.id.toString()));
  }
}
