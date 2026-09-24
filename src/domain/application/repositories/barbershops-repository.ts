import type { Barbershop } from "../../enterprise/entities/barbershop";
import type { Membership } from "../../enterprise/entities/membership";

export interface BarbershopsRepository {
  createWithOwnerMembership(
    barbershop: Barbershop,
    ownerMembership: Membership,
  ): Promise<Barbershop>;
  findById(id: string): Promise<Barbershop | null>;
  findBySlugOrCnpj(slug: string, cnpj: string): Promise<Barbershop | null>;
  findManyByOwnerId(ownerId: string): Promise<Barbershop[]>;
}
