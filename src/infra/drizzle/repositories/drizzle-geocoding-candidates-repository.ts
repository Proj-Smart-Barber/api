import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "../index";
import { geocodingCandidates, geocodingUsageBuckets } from "../schema";
import type {
  GeocodingCandidatePersistence,
  GeocodingCandidatesRepository,
} from "../../../domain/application/repositories/geocoding-candidates-repository";

export class DrizzleGeocodingCandidatesRepository
  implements GeocodingCandidatesRepository
{
  // biome-ignore lint/suspicious/noExplicitAny: supports default project db or isolated test database
  private customDb?: any;

  constructor(customDb?: any) {
    this.customDb = customDb;
  }

  private get database(): any {
    return this.customDb ?? db;
  }

  async findById(
    id: string,
    tx?: any,
  ): Promise<GeocodingCandidatePersistence | null> {
    const executor = tx ?? this.database;
    const [row] = await executor
      .select()
      .from(geocodingCandidates)
      .where(eq(geocodingCandidates.id, id));

    if (!row) return null;

    return {
      id: row.id,
      actorId: row.actorId,
      barbershopId: row.barbershopId,
      addressHash: row.addressHash,
      latitude: row.latitude,
      longitude: row.longitude,
      placeId: row.placeId,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      createdAt: row.createdAt ?? new Date(),
    };
  }

  async create(
    candidate: Omit<GeocodingCandidatePersistence, "createdAt" | "consumedAt">,
    tx?: any,
  ): Promise<GeocodingCandidatePersistence> {
    const executor = tx ?? this.database;
    const [row] = await executor
      .insert(geocodingCandidates)
      .values({
        id: candidate.id,
        actorId: candidate.actorId,
        barbershopId: candidate.barbershopId,
        addressHash: candidate.addressHash,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        placeId: candidate.placeId,
        expiresAt: candidate.expiresAt,
      })
      .returning();

    return {
      id: row.id,
      actorId: row.actorId,
      barbershopId: row.barbershopId,
      addressHash: row.addressHash,
      latitude: row.latitude,
      longitude: row.longitude,
      placeId: row.placeId,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      createdAt: row.createdAt ?? new Date(),
    };
  }

  async consume(id: string, tx?: any): Promise<void> {
    const executor = tx ?? this.database;
    await executor
      .update(geocodingCandidates)
      .set({ consumedAt: new Date() })
      .where(eq(geocodingCandidates.id, id));
  }

  async deleteExpired(now: Date = new Date(), tx?: any): Promise<number> {
    const executor = tx ?? this.database;
    const result = await executor
      .delete(geocodingCandidates)
      .where(lte(geocodingCandidates.expiresAt, now))
      .returning({ id: geocodingCandidates.id });

    return result.length;
  }

  async checkAndIncrementUsage(
    actorId: string,
    limitPerHour = 30,
    limitPerDay = 100,
    tx?: any,
  ): Promise<boolean> {
    const executor = tx ?? this.database;
    const now = new Date();

    // Início da hora atual
    const hourStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        0,
        0,
      ),
    );
    const hourExpiresAt = new Date(hourStart.getTime() + 2 * 60 * 60 * 1000);

    // Início do dia atual
    const dayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    const dayExpiresAt = new Date(dayStart.getTime() + 25 * 60 * 60 * 1000);

    // Verificar bucket horário
    const [hourBucket] = await executor
      .select({ count: geocodingUsageBuckets.count })
      .from(geocodingUsageBuckets)
      .where(
        and(
          eq(geocodingUsageBuckets.scope, "ACTOR"),
          eq(geocodingUsageBuckets.scopeId, actorId),
          eq(geocodingUsageBuckets.windowType, "HOURLY"),
          eq(geocodingUsageBuckets.windowStart, hourStart),
        ),
      );

    if (hourBucket && hourBucket.count >= limitPerHour) {
      return false;
    }

    // Verificar bucket diário
    const [dayBucket] = await executor
      .select({ count: geocodingUsageBuckets.count })
      .from(geocodingUsageBuckets)
      .where(
        and(
          eq(geocodingUsageBuckets.scope, "ACTOR"),
          eq(geocodingUsageBuckets.scopeId, actorId),
          eq(geocodingUsageBuckets.windowType, "DAILY"),
          eq(geocodingUsageBuckets.windowStart, dayStart),
        ),
      );

    if (dayBucket && dayBucket.count >= limitPerDay) {
      return false;
    }

    // Incrementar bucket horário
    await executor
      .insert(geocodingUsageBuckets)
      .values({
        scope: "ACTOR",
        scopeId: actorId,
        windowType: "HOURLY",
        windowStart: hourStart,
        count: 1,
        expiresAt: hourExpiresAt,
      })
      .onConflictDoUpdate({
        target: [
          geocodingUsageBuckets.scope,
          geocodingUsageBuckets.scopeId,
          geocodingUsageBuckets.windowType,
          geocodingUsageBuckets.windowStart,
        ],
        set: { count: sql`${geocodingUsageBuckets.count} + 1` },
      });

    // Incrementar bucket diário
    await executor
      .insert(geocodingUsageBuckets)
      .values({
        scope: "ACTOR",
        scopeId: actorId,
        windowType: "DAILY",
        windowStart: dayStart,
        count: 1,
        expiresAt: dayExpiresAt,
      })
      .onConflictDoUpdate({
        target: [
          geocodingUsageBuckets.scope,
          geocodingUsageBuckets.scopeId,
          geocodingUsageBuckets.windowType,
          geocodingUsageBuckets.windowStart,
        ],
        set: { count: sql`${geocodingUsageBuckets.count} + 1` },
      });

    return true;
  }
}
