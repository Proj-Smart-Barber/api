import type { BarbershopsRepository } from "@/domain/application/repositories/barbershops-repository";
import type { Barbershop } from "@/domain/enterprise/entities/barbershop";

export class InMemoryBarbershopsRepository implements BarbershopsRepository {
  public items: Barbershop[] = [];

  async findById(id: string): Promise<Barbershop | null> {
    const barbershop = this.items.find((item) => item.id.toString() === id);

    if (!barbershop) {
      return null;
    }

    return barbershop;
  }
}
