import { and, asc, eq, sql } from "drizzle-orm";
import type {
  ListTeamOptions,
  MembershipsRepository,
  TeamMemberWithUser,
} from "../../../domain/application/repositories/memberships-repository";
import type { Invitation } from "../../../domain/enterprise/entities/invitation";
import type { Membership } from "../../../domain/enterprise/entities/membership";
import { db } from "../index";
import { DrizzleInvitationMapper } from "../mappers/drizzle-invitation-mapper";
import { DrizzleMembershipMapper } from "../mappers/drizzle-membership-mapper";
import { invitations, membership, users } from "../schema";

export class DrizzleMembershipsRepository implements MembershipsRepository {
  async create(membershipEntity: Membership): Promise<Membership> {
    const [created] = await db
      .insert(membership)
      .values(DrizzleMembershipMapper.toDrizzle(membershipEntity))
      .returning();

    return DrizzleMembershipMapper.toDomain(created);
  }

  async save(membershipEntity: Membership, tx?: any): Promise<void> {
    const executor = tx ?? db;
    await executor
      .update(membership)
      .set(DrizzleMembershipMapper.toDrizzle(membershipEntity))
      .where(eq(membership.id, membershipEntity.id.toString()));
  }

  async findById(id: string, tx?: any): Promise<Membership | null> {
    const executor = tx ?? db;
    const [row] = await executor
      .select()
      .from(membership)
      .where(eq(membership.id, id));

    if (!row) {
      return null;
    }

    return DrizzleMembershipMapper.toDomain(row);
  }

  async findByBarbershopAndUser(
    barbershopId: string,
    userId: string,
    tx?: any,
  ): Promise<Membership | null> {
    const executor = tx ?? db;
    const [row] = await executor
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

  async findManyByBarbershopId(barbershopId: string): Promise<Membership[]> {
    const rows = await db
      .select()
      .from(membership)
      .where(eq(membership.barbershopId, barbershopId));

    return rows.map(DrizzleMembershipMapper.toDomain);
  }

  async findManyByBarbershopIdWithDetails(
    barbershopId: string,
    options: ListTeamOptions,
  ): Promise<{ items: TeamMemberWithUser[]; total: number }> {
    const conditions = [eq(membership.barbershopId, barbershopId)];
    if (options.state) {
      conditions.push(eq(membership.state, options.state));
    }
    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(membership)
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .select({
        membership: membership,
        user: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(membership)
      .innerJoin(users, eq(membership.userId, users.id))
      .where(whereClause)
      .orderBy(asc(membership.createdAt), asc(membership.id))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      items: rows.map((r) => ({
        membership: DrizzleMembershipMapper.toDomain(r.membership),
        user: r.user,
      })),
      total,
    };
  }

  async acceptInvitation(
    invitation: Invitation,
    membershipEntity: Membership,
    userToPromote?: any,
  ): Promise<void> {
    await db.transaction(async (transaction) => {
      if (userToPromote) {
        await transaction
          .update(users)
          .set({ accountType: userToPromote.accountType })
          .where(eq(users.id, userToPromote.id.toString()));
      }

      const [existing] = await transaction
        .select()
        .from(membership)
        .where(
          and(
            eq(
              membership.barbershopId,
              membershipEntity.barbershopId.toString(),
            ),
            eq(membership.userId, membershipEntity.userId.toString()),
          ),
        );

      if (existing) {
        await transaction
          .update(membership)
          .set(DrizzleMembershipMapper.toDrizzle(membershipEntity))
          .where(eq(membership.id, existing.id));
      } else {
        await transaction
          .insert(membership)
          .values(DrizzleMembershipMapper.toDrizzle(membershipEntity));
      }

      await transaction
        .update(invitations)
        .set(DrizzleInvitationMapper.toDrizzle(invitation))
        .where(eq(invitations.id, invitation.id.toString()));
    });
  }
}

