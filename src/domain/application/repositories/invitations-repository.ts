import type { Invitation } from "../../enterprise/entities/invitation";

export interface InvitationsRepository {
  create(invitation: Invitation, tx?: any): Promise<Invitation>;
  save(invitation: Invitation, tx?: any): Promise<Invitation>;
  delete(id: string, tx?: any): Promise<void>;
  findById(id: string, tx?: any): Promise<Invitation | null>;
  findByTokenHash(tokenHash: string, tx?: any): Promise<Invitation | null>;
  findManyByBarbershopId(
    barbershopId: string,
    tx?: any,
  ): Promise<Invitation[]>;
  findManyByBarbershopIdPaginated(
    barbershopId: string,
    options: { page: number; limit: number },
    tx?: any,
  ): Promise<{ items: Invitation[]; total: number }>;
  findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
    tx?: any,
  ): Promise<Invitation | null>;
  findPendingByEmail(email: string, tx?: any): Promise<Invitation[]>;
}
