import type { BarberRegistrationsRepository } from "../../src/domain/application/repositories/barber-registrations-repository";
import type { BarberRegistration } from "../../src/domain/enterprise/entities/barber-registration";

export class InMemoryBarberRegistrationsRepository
  implements BarberRegistrationsRepository
{
  public items: BarberRegistration[] = [];

  async create(registration: BarberRegistration): Promise<BarberRegistration> {
    this.items.push(registration);
    return registration;
  }

  async save(registration: BarberRegistration): Promise<BarberRegistration> {
    const index = this.items.findIndex(
      (item) => item.id.toString() === registration.id.toString(),
    );
    if (index >= 0) {
      this.items[index] = registration;
    }
    return registration;
  }

  async findById(id: string): Promise<BarberRegistration | null> {
    const registration = this.items.find((item) => item.id.toString() === id);
    return registration ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<BarberRegistration | null> {
    const registration = this.items.find((item) => item.tokenHash === tokenHash);
    return registration ?? null;
  }

  async findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
  ): Promise<BarberRegistration | null> {
    const registration = this.items.find(
      (item) =>
        item.barbershopId.toString() === barbershopId &&
        item.email === email.toLowerCase(),
    );
    return registration ?? null;
  }

  async findByCpf(cpf: string): Promise<BarberRegistration | null> {
    const cleanCpf = cpf.replace(/\D/g, "");
    const registration = this.items.find(
      (item) => item.cpf.replace(/\D/g, "") === cleanCpf,
    );
    return registration ?? null;
  }
}
