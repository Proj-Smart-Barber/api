import type { BarbershopsRepository } from "../../../domain/application/repositories/barbershops-repository";
import type { Barbershop } from "../../../domain/enterprise/entities/barbershop";
import {
  Role,
  type Membership,
} from "../../../domain/enterprise/entities/membership";
import { eq, or, and, sql } from "drizzle-orm";
import { db } from "../index";
import { DrizzleBarbershopMapper } from "../mappers/drizzle-barbershop-mapper";
import { DrizzleMembershipMapper } from "../mappers/drizzle-membership-mapper";
import { barbershops, membership, users } from "../schema";

export class DrizzleBarbershopsRepository implements BarbershopsRepository {
  async createWithOwnerMembership(
    barbershop: Barbershop,
    ownerMembership: Membership,
  ): Promise<Barbershop> {
    this.validateOwnerMembership(barbershop, ownerMembership);

    return db.transaction(async (transaction) => {
      const [createdBarbershop] = await transaction
        .insert(barbershops)
        .values(DrizzleBarbershopMapper.toDrizzle(barbershop))
        .returning();

      if (!createdBarbershop) {
        throw new Error("The barbershop could not be created.");
      }

      await transaction
        .insert(membership)
        .values(DrizzleMembershipMapper.toDrizzle(ownerMembership));

      // Read the current role inside the UPDATE; a pre-transaction user snapshot
      // must never overwrite concurrent credential, profile or admin changes.
      const [owner] = await transaction
        .update(users)
        .set({
          accountType: sql`CASE WHEN ${users.accountType} = 'PLATFORM_ADMIN'
            THEN ${users.accountType} ELSE 'OWNER' END`,
          onboardingIntent: null,
        })
        .where(eq(users.id, barbershop.ownerId.toString()))
        .returning({ id: users.id });

      if (!owner) {
        throw new Error("The barbershop owner user could not be updated.");
      }

      return DrizzleBarbershopMapper.toDomain(createdBarbershop);
    });
  }

  async findById(id: string): Promise<Barbershop | null> {
    const [barbershop] = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, id));

    if (!barbershop) {
      return null;
    }

    return DrizzleBarbershopMapper.toDomain(barbershop);
  }

  async findBySlugOrCnpj(
    slug: string,
    cnpj: string,
  ): Promise<Barbershop | null> {
    const [barbershop] = await db
      .select()
      .from(barbershops)
      .where(or(eq(barbershops.slug, slug), eq(barbershops.cnpj, cnpj)));

    if (!barbershop) {
      return null;
    }

    return DrizzleBarbershopMapper.toDomain(barbershop);
  }

  async findManyByOwnerId(ownerId: string): Promise<Barbershop[]> {
    const results = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.ownerId, ownerId));

    return results.map(DrizzleBarbershopMapper.toDomain);
  }

  async findManyByStaffId(
    staffId: string,
  ): Promise<Array<{ barbershop: Barbershop; role: string }>> {
    const rows = await db
      .select({
        barbershop: barbershops,
        role: membership.role,
      })
      .from(membership)
      .innerJoin(barbershops, eq(membership.barbershopId, barbershops.id))
      .where(
        and(eq(membership.userId, staffId), eq(membership.state, "ACTIVE")),
      );

    return rows.map((row) => ({
      barbershop: DrizzleBarbershopMapper.toDomain(row.barbershop),
      role: row.role,
    }));
  }

  private validateOwnerMembership(
    barbershop: Barbershop,
    ownerMembership: Membership,
  ): void {
    const hasValidOwner =
      ownerMembership.barbershopId.toString() === barbershop.id.toString() &&
      ownerMembership.userId.toString() === barbershop.ownerId.toString() &&
      ownerMembership.role === Role.OWNER;

    if (!hasValidOwner) {
      throw new Error(
        "The owner membership does not match the barbershop owner.",
      );
    }
  }
}
