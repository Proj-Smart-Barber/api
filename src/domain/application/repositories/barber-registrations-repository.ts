import type { BarberRegistration } from "../../enterprise/entities/barber-registration";

export interface BarberRegistrationsRepository {
  create(
    registration: BarberRegistration,
    tx?: any,
  ): Promise<BarberRegistration>;
  save(registration: BarberRegistration, tx?: any): Promise<BarberRegistration>;
  findById(id: string, tx?: any): Promise<BarberRegistration | null>;
  findByTokenHash(tokenHash: string, tx?: any): Promise<BarberRegistration | null>;
  findByInvitationId(
    invitationId: string,
    tx?: any,
  ): Promise<BarberRegistration | null>;
  findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
    tx?: any,
  ): Promise<BarberRegistration | null>;
  findByCpf(cpf: string, tx?: any): Promise<BarberRegistration | null>;
}
