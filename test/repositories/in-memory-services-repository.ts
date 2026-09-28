import type {
  ServicesRepository,
  FindManyByBarbershopIdParams,
} from "../../src/domain/application/repositories/services-repository";
import type { Service } from "../../src/domain/enterprise/entities/service";

export class InMemoryServicesRepository implements ServicesRepository {
  public items: Service[] = [];

  async create(service: Service): Promise<void> {
    this.items.push(service);
  }

  async save(service: Service): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === service.id.toString(),
    );
    if (itemIndex >= 0) {
      this.items[itemIndex] = service;
    }
  }

  async findById(id: string): Promise<Service | null> {
    const service = this.items.find((item) => item.id.toString() === id);

    if (!service) {
      return null;
    }

    return service;
  }

  async findByIdAndBarbershopId(
    id: string,
    barbershopId: string,
  ): Promise<Service | null> {
    const service = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.barbershopId.toString() === barbershopId,
    );

    if (!service) {
      return null;
    }

    return service;
  }

  async findManyByIds(ids: string[]): Promise<Service[]> {
    return this.items.filter((item) => ids.includes(item.id.toString()));
  }

  async findManyActiveByBarbershopIdAndIds(
    barbershopId: string,
    ids: string[],
  ): Promise<Service[]> {
    return this.items.filter(
      (item) =>
        item.barbershopId.toString() === barbershopId &&
        item.isActive &&
        ids.includes(item.id.toString()),
    );
  }

  async findManyByBarbershopId(
    barbershopId: string,
    { page, limit, includeInactive }: FindManyByBarbershopIdParams,
  ): Promise<{ services: Service[]; total: number }> {
    const filtered = this.items
      .filter((item) => {
        if (item.barbershopId.toString() !== barbershopId) return false;
        if (!includeInactive && !item.isActive) return false;
        return true;
      })
      .sort(
        (a, b) =>
          a.title.localeCompare(b.title) ||
          a.id.toString().localeCompare(b.id.toString()),
      );

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      services: paginated,
      total,
    };
  }
}
