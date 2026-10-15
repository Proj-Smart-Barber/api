import { and, desc, eq, sql } from "drizzle-orm";
import type { InvitationsRepository } from "../../../domain/application/repositories/invitations-repository";
import type { Invitation } from "../../../domain/enterprise/entities/invitation";
import { db } from "../index";
import { DrizzleInvitationMapper } from "../mappers/drizzle-invitation-mapper";
import { invitations } from "../schema";

export class DrizzleInvitationsRepository implements InvitationsRepository {
  async create(invitation: Invitation): Promise<Invitation> {
    const [created] = await db
      .insert(invitations)
      .values(DrizzleInvitationMapper.toDrizzle(invitation))
      .returning();

    return DrizzleInvitationMapper.toDomain(created);
  }

  async save(invitation: Invitation): Promise<Invitation> {
    const [updated] = await db
      .update(invitations)
      .set(DrizzleInvitationMapper.toDrizzle(invitation))
      .where(eq(invitations.id, invitation.id.toString()))
      .returning();

    return DrizzleInvitationMapper.toDomain(updated);
  }

  async findById(id: string): Promise<Invitation | null> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, id));

    if (!invitation) {
      return null;
    }

    return DrizzleInvitationMapper.toDomain(invitation);
  }

  async delete(id: string): Promise<void> {
    await db.delete(invitations).where(eq(invitations.id, id));
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash));

    if (!invitation) {
      return null;
    }

    return DrizzleInvitationMapper.toDomain(invitation);
  }

  async findManyByBarbershopId(barbershopId: string): Promise<Invitation[]> {
    const results = await db
      .select()
      .from(invitations)
      .where(eq(invitations.barbershopId, barbershopId));

    return results.map(DrizzleInvitationMapper.toDomain);
  }

  async findManyByBarbershopIdPaginated(
    barbershopId: string,
    options: { page: number; limit: number },
  ): Promise<{ items: Invitation[]; total: number }> {
    const whereClause = eq(invitations.barbershopId, barbershopId);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitations)
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .select()
      .from(invitations)
      .where(whereClause)
      .orderBy(desc(invitations.createdAt))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      items: rows.map(DrizzleInvitationMapper.toDomain),
      total,
    };
  }

  async findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
  ): Promise<Invitation | null> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.barbershopId, barbershopId),
          eq(invitations.email, email.toLowerCase()),
        ),
      );

    if (!invitation) {
      return null;
    }

    return DrizzleInvitationMapper.toDomain(invitation);
  }

  async findPendingByEmail(email: string): Promise<Invitation[]> {
    const results = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email.toLowerCase()),
          eq(invitations.status, "PENDING"),
        ),
      );

    return results.map(DrizzleInvitationMapper.toDomain);
  }
}
