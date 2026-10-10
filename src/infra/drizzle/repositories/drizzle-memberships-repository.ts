import { and, eq } from "drizzle-orm";
import type { MembershipsRepository } from "../../../domain/application/repositories/memberships-repository";
import type { Invitation } from "../../../domain/enterprise/entities/invitation";
import type { Membership } from "../../../domain/enterprise/entities/membership";
import { db } from "../index";
import { DrizzleInvitationMapper } from "../mappers/drizzle-invitation-mapper";
import { DrizzleMembershipMapper } from "../mappers/drizzle-membership-mapper";
import { invitations, membership } from "../schema";

export class DrizzleMembershipsRepository implements MembershipsRepository {
  async create(membershipEntity: Membership): Promise<Membership> {
    const [created] = await db
      .insert(membership)
      .values(DrizzleMembershipMapper.toDrizzle(membershipEntity))
      .returning();

    return DrizzleMembershipMapper.toDomain(created);
  }

  async findByBarbershopAndUser(
    barbershopId: string,
    userId: string,
  ): Promise<Membership | null> {
    const [row] = await db
      .select()
      .from(membership)
      .where(
        and(
          eq(membership.barbershopId, barbershopId),
          eq(membership.userId, userId),
        ),
      );

    if (!row) {
      return null;
    }

    return DrizzleMembershipMapper.toDomain(row);
  }

  async acceptInvitation(
    invitation: Invitation,
    membershipEntity: Membership,
  ): Promise<void> {
    await db.transaction(async (transaction) => {
      await transaction
        .insert(membership)
        .values(DrizzleMembershipMapper.toDrizzle(membershipEntity));

      await transaction
        .update(invitations)
        .set(DrizzleInvitationMapper.toDrizzle(invitation))
        .where(eq(invitations.id, invitation.id.toString()));
    });
  }
}
