import type { Invitation } from "../../enterprise/entities/invitation";

export interface InvitationsRepository {
  create(invitation: Invitation): Promise<Invitation>;
  save(invitation: Invitation): Promise<Invitation>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Invitation | null>;
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  findManyByBarbershopId(barbershopId: string): Promise<Invitation[]>;
  findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
  ): Promise<Invitation | null>;
  findPendingByEmail(email: string): Promise<Invitation[]>;
}
