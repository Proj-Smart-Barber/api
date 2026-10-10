import type { InvitationsRepository } from "../../src/domain/application/repositories/invitations-repository";
import type { Invitation } from "../../src/domain/enterprise/entities/invitation";

export class InMemoryInvitationsRepository implements InvitationsRepository {
  public items: Invitation[] = [];

  async create(invitation: Invitation): Promise<Invitation> {
    this.items.push(invitation);

    return invitation;
  }

  async save(invitation: Invitation): Promise<Invitation> {
    const index = this.items.findIndex(
      (item) => item.id.toString() === invitation.id.toString(),
    );

    if (index >= 0) {
      this.items[index] = invitation;
    }

    return invitation;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id.toString() !== id);
  }

  async findById(id: string): Promise<Invitation | null> {
    const invitation = this.items.find((item) => item.id.toString() === id);

    return invitation ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const invitation = this.items.find((item) => item.tokenHash === tokenHash);

    return invitation ?? null;
  }

  async findManyByBarbershopId(barbershopId: string): Promise<Invitation[]> {
    return this.items.filter(
      (item) => item.barbershopId.toString() === barbershopId,
    );
  }

  async findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
  ): Promise<Invitation | null> {
    const invitation = this.items.find(
      (item) =>
        item.barbershopId.toString() === barbershopId &&
        item.email === email.toLowerCase(),
    );

    return invitation ?? null;
  }

  async findPendingByEmail(email: string): Promise<Invitation[]> {
    return this.items.filter(
      (item) => item.email === email.toLowerCase() && item.status === "PENDING",
    );
  }
}
