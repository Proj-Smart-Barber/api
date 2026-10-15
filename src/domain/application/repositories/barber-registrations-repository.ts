import type { BarberRegistration } from "../../enterprise/entities/barber-registration";

export interface BarberRegistrationsRepository {
  create(registration: BarberRegistration): Promise<BarberRegistration>;
  save(registration: BarberRegistration): Promise<BarberRegistration>;
  findById(id: string): Promise<BarberRegistration | null>;
  findByTokenHash(tokenHash: string): Promise<BarberRegistration | null>;
  findByInvitationId(invitationId: string): Promise<BarberRegistration | null>;
  findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
  ): Promise<BarberRegistration | null>;
  findByCpf(cpf: string): Promise<BarberRegistration | null>;
}
