import type { Barbershop } from "../../enterprise/entities/barbershop";

export interface BarbershopsRepository {
  findById(id: string): Promise<Barbershop | null>;
  findByOwnerId(ownerId: string): Promise<Barbershop | null>;
}
