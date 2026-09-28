import type { Service } from "../../enterprise/entities/service";

export interface FindManyByBarbershopIdParams {
  page: number;
  limit: number;
  includeInactive?: boolean;
}

export interface ServicesRepository {
  create(service: Service): Promise<void>;
  save(service: Service): Promise<void>;
  findById(id: string): Promise<Service | null>;
  findByIdAndBarbershopId(
    id: string,
    barbershopId: string,
  ): Promise<Service | null>;
  findManyByIds(ids: string[]): Promise<Service[]>;
  findManyActiveByBarbershopIdAndIds(
    barbershopId: string,
    ids: string[],
  ): Promise<Service[]>;
  findManyByBarbershopId(
    barbershopId: string,
    params: FindManyByBarbershopIdParams,
  ): Promise<{ services: Service[]; total: number }>;
}
