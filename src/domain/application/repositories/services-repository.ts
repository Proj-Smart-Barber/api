import type { Service } from "../../enterprise/entities/service";

export interface ServicesRepository {
  findById(id: string): Promise<Service | null>;
  findManyByIds(ids: string[]): Promise<Service[]>;
}
