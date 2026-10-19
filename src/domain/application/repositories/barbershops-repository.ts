import type { Barbershop } from "../../enterprise/entities/barbershop";
import type { Membership } from "../../enterprise/entities/membership";

export interface BarbershopsRepository {
  createWithOwnerMembership(
    barbershop: Barbershop,
    ownerMembership: Membership,
  ): Promise<Barbershop>;
  findById(id: string, tx?: unknown): Promise<Barbershop | null>;
  findBySlugOrCnpj(slug: string, cnpj: string): Promise<Barbershop | null>;
  findManyByOwnerId(ownerId: string): Promise<Barbershop[]>;
  findManyByStaffId(
    staffId: string,
  ): Promise<Array<{ barbershop: Barbershop; role: string }>>;
  save(barbershop: Barbershop, tx?: unknown): Promise<void>;
  create?(barbershop: Barbershop): Promise<Barbershop>;
}
