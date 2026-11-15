import type { BarbershopsRepository } from "../../../domain/application/repositories/barbershops-repository";
import type { Barbershop } from "../../../domain/enterprise/entities/barbershop";
import {
  Role,
  type Membership,
} from "../../../domain/enterprise/entities/membership";
import { eq, or, and, sql, inArray } from "drizzle-orm";
import { db } from "../index";
import { DrizzleBarbershopMapper } from "../mappers/drizzle-barbershop-mapper";
import { DrizzleMembershipMapper } from "../mappers/drizzle-membership-mapper";
import { barbershops, membership, users, reviewItems, reviews } from "../schema";

export class DrizzleBarbershopsRepository implements BarbershopsRepository {
  private customDb?: any;

  constructor(customDb?: any) {
    this.customDb = customDb;
  }

  private get database() {
    return this.customDb ?? db;
  }

  async createWithOwnerMembership(
    barbershop: Barbershop,
    ownerMembership: Membership,
  ): Promise<Barbershop> {
    this.validateOwnerMembership(barbershop, ownerMembership);

    return this.database.transaction(async (transaction: any) => {
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

  private async enrichBarbershopsWithCanonicalRatings(
    barbershopsList: Barbershop[],
    tx?: any,
  ): Promise<void> {
    if (barbershopsList.length === 0) {
      return;
    }

    const executor = tx ?? this.database;
    const shopIds = barbershopsList.map((b) => b.id.toString());

    const stats = await executor
      .select({
        shopId: reviewItems.targetId,
        avgRating: sql<string>`AVG(${reviewItems.rating})::numeric(10,2)`,
        count: sql<number>`COUNT(${reviewItems.id})::int`,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(
        and(
          eq(reviewItems.targetType, "BARBERSHOP"),
          inArray(reviewItems.targetId, shopIds),
          eq(reviews.status, "PUBLISHED"),
        ),
      )
      .groupBy(reviewItems.targetId);

    const statsMap = new Map<string, { rating: number; count: number }>();
    for (const row of stats) {
      if (!row.shopId) continue;
      const count = Number(row.count ?? 0);
      const rawRating = row.avgRating ? parseFloat(String(row.avgRating)) : 0;
      const rating =
        count > 0 && !Number.isNaN(rawRating)
          ? Number(rawRating.toFixed(2))
          : 0;
      statsMap.set(row.shopId, { rating, count });
    }

    for (const barbershop of barbershopsList) {
      const metric = statsMap.get(barbershop.id.toString());
      if (metric) {
        barbershop.updateRatingMetrics(metric.rating, metric.count);
      } else {
        barbershop.updateRatingMetrics(0, 0);
      }
    }
  }

  async findById(id: string, tx?: any): Promise<Barbershop | null> {
    const executor = tx ?? this.database;
    const [barbershopRow] = await executor
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, id));

    if (!barbershopRow) {
      return null;
    }

    const barbershop = DrizzleBarbershopMapper.toDomain(barbershopRow);
    await this.enrichBarbershopsWithCanonicalRatings([barbershop], executor);
    return barbershop;
  }

  async findBySlugOrCnpj(
    slug: string,
    cnpj: string,
  ): Promise<Barbershop | null> {
    const [barbershopRow] = await this.database
      .select()
      .from(barbershops)
      .where(or(eq(barbershops.slug, slug), eq(barbershops.cnpj, cnpj)));

    if (!barbershopRow) {
      return null;
    }

    const barbershop = DrizzleBarbershopMapper.toDomain(barbershopRow);
    await this.enrichBarbershopsWithCanonicalRatings([barbershop]);
    return barbershop;
  }

  async findManyByOwnerId(ownerId: string): Promise<Barbershop[]> {
    const results = await this.database
      .select()
      .from(barbershops)
      .where(eq(barbershops.ownerId, ownerId));

    const domainBarbershops = results.map(DrizzleBarbershopMapper.toDomain);
    await this.enrichBarbershopsWithCanonicalRatings(domainBarbershops);
    return domainBarbershops;
  }

  async findManyByStaffId(
    staffId: string,
  ): Promise<Array<{ barbershop: Barbershop; role: string }>> {
    const rows = await this.database
      .select({
        barbershop: barbershops,
        role: membership.role,
      })
      .from(membership)
      .innerJoin(barbershops, eq(membership.barbershopId, barbershops.id))
      .where(
        and(eq(membership.userId, staffId), eq(membership.state, "ACTIVE")),
      );

    const domainBarbershops = rows.map((row: any) =>
      DrizzleBarbershopMapper.toDomain(row.barbershop),
    );
    await this.enrichBarbershopsWithCanonicalRatings(domainBarbershops);

    return rows.map((row: any, index: number) => ({
      barbershop: domainBarbershops[index],
      role: row.role,
    }));
  }

  async save(barbershop: Barbershop, tx?: any): Promise<void> {
    const executor = tx ?? this.database;
    await executor
      .update(barbershops)
      .set({
        name: barbershop.name,
        location: barbershop.location,
        avatarUrl: barbershop.avatarUrl ?? null,
        googleMapsUrl: barbershop.googleMapsUrl ?? null,
        coverUrl: barbershop.coverUrl ?? null,
        rating: barbershop.rating.toFixed(2),
        reviewCount: barbershop.reviewCount,
        slug: barbershop.slug.value,
        cnpj: barbershop.cnpj,
        status: barbershop.status,
      })
      .where(eq(barbershops.id, barbershop.id.toString()));
  }

  async updateRatingMetrics(
    barbershopId: string,
    rating: number,
    reviewCount: number,
    tx?: any
  ): Promise<void> {
    const executor = tx ?? this.database;
    await executor
      .update(barbershops)
      .set({
        rating: rating.toFixed(2),
        reviewCount,
      })
      .where(eq(barbershops.id, barbershopId));
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
