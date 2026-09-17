import type { Barbershop } from "../../enterprise/entities/barbershop";

export interface BarbershopsRepository {
  save(barbershop: Barbershop): Promise<Barbershop>;
}
