import type { BarbershopsRepository } from "@/domain/application/repositories/barbershops-repository";
import type { Barbershop } from "@/domain/enterprise/entities/barbershop";
import { Role, type Membership } from "@/domain/enterprise/entities/membership";

export class InMemoryBarbershopsRepository implements BarbershopsRepository {
  public items: Barbershop[] = [];
  public memberships: Membership[] = [];

  async createWithOwnerMembership(
    barbershop: Barbershop,
    ownerMembership: Membership,
  ): Promise<Barbershop> {
    const hasValidOwner =
      ownerMembership.barbershopId.toString() === barbershop.id.toString() &&
      ownerMembership.staffId.toString() === barbershop.ownerId.toString() &&
      ownerMembership.role === Role.OWNER;

    if (!hasValidOwner) {
      throw new Error(
        "The owner membership does not match the barbershop owner.",
      );
    }

    this.items.push(barbershop);
    this.memberships.push(ownerMembership);

    return barbershop;
  }

  async findById(id: string): Promise<Barbershop | null> {
    const barbershop = this.items.find((item) => item.id.toString() === id);

    if (!barbershop) {
      return null;
    }

    return barbershop;
  }

  async findBySlugOrCnpj(
    slug: string,
    cnpj: string,
  ): Promise<Barbershop | null> {
    const barbershop = this.items.find(
      (item) => item.slug.value === slug || item.cnpj === cnpj,
    );

    if (!barbershop) {
      return null;
    }

    return barbershop;
  }

  async findManyByOwnerId(ownerId: string): Promise<Barbershop[]> {
    return this.items.filter((item) => item.ownerId.toString() === ownerId);
  }
}
