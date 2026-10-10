import type { MembershipsRepository } from "../../src/domain/application/repositories/memberships-repository";
import type { Invitation } from "../../src/domain/enterprise/entities/invitation";
import type { Membership } from "../../src/domain/enterprise/entities/membership";

export class InMemoryMembershipsRepository implements MembershipsRepository {
  public items: Membership[] = [];

  async create(membership: Membership): Promise<Membership> {
    this.items.push(membership);

    return membership;
  }

  async findByBarbershopAndUser(
    barbershopId: string,
    userId: string,
  ): Promise<Membership | null> {
    const membership = this.items.find(
      (item) =>
        item.barbershopId.toString() === barbershopId &&
        item.userId.toString() === userId,
    );

    return membership ?? null;
  }

  async acceptInvitation(
    _invitation: Invitation,
    membership: Membership,
  ): Promise<void> {
    // The invitation entity is the same reference stored in the in-memory
    // invitations repository, so it was already mutated by markAccepted().
    this.items.push(membership);
  }
}
