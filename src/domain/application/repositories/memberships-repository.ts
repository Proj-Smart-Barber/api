import type { Invitation } from "../../enterprise/entities/invitation";
import type { Membership } from "../../enterprise/entities/membership";

export interface MembershipsRepository {
  create(membership: Membership): Promise<Membership>;
  findByBarbershopAndUser(
    barbershopId: string,
    userId: string,
  ): Promise<Membership | null>;
  /**
   * Atomically creates the membership and marks its invitation as accepted.
   * The invitation entity is expected to be already mutated (markAccepted).
   */
  acceptInvitation(
    invitation: Invitation,
    membership: Membership,
  ): Promise<void>;
}
