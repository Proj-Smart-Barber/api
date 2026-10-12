import type { Invitation } from "../../enterprise/entities/invitation";
import type {
  Membership,
  MembershipState,
} from "../../enterprise/entities/membership";

export interface TeamMemberWithUser {
  membership: Membership;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface ListTeamOptions {
  state?: MembershipState;
  page: number;
  limit: number;
}

export interface MembershipsRepository {
  create(membership: Membership): Promise<Membership>;
  save(membership: Membership, tx?: any): Promise<void>;
  findById(id: string, tx?: any): Promise<Membership | null>;
  findByBarbershopAndUser(
    barbershopId: string,
    userId: string,
    tx?: any,
  ): Promise<Membership | null>;
  findManyByBarbershopId(barbershopId: string): Promise<Membership[]>;
  findManyByBarbershopIdWithDetails(
    barbershopId: string,
    options: ListTeamOptions,
  ): Promise<{ items: TeamMemberWithUser[]; total: number }>;
  /**
   * Atomically creates the membership and marks its invitation as accepted.
   * The invitation entity is expected to be already mutated (markAccepted).
   */
  acceptInvitation(
    invitation: Invitation,
    membership: Membership,
  ): Promise<void>;
}
