import { and, asc, eq, lte, or, sql } from "drizzle-orm";
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

  async consume(id: string, tx?: any): Promise<boolean> {
    const executor = tx ?? this.database;
    const result = await executor
      .update(geocodingCandidates)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(geocodingCandidates.id, id),
          sql`${geocodingCandidates.consumedAt} IS NULL`,
        ),
      )
      .returning({ id: geocodingCandidates.id });

    return result.length > 0;
  }

  async deleteExpired(now: Date = new Date(), tx?: any): Promise<number> {
    const executor = tx ?? this.database;
    const result = await executor
      .delete(geocodingCandidates)
      .where(
        and(
          lte(geocodingCandidates.expiresAt, now),
          sql`${geocodingCandidates.id} IN (
            SELECT id FROM ${geocodingCandidates}
            WHERE ${geocodingCandidates.expiresAt} <= ${now}
            LIMIT 500
          )`,
        ),
      )
      .returning({ id: geocodingCandidates.id });

    return result.length;
  }

  async checkAndIncrementUsage(
    actorId: string,
    limitPerHour = 30,
    limitPerDay = 100,
    tx?: any,
  ): Promise<boolean> {
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

    const targetBucketsCondition = or(
      and(
        eq(geocodingUsageBuckets.windowType, "HOURLY"),
        eq(geocodingUsageBuckets.windowStart, hourStart),
      ),
      and(
        eq(geocodingUsageBuckets.windowType, "DAILY"),
        eq(geocodingUsageBuckets.windowStart, dayStart),
      ),
    );

    const runInTx = async (txRunner: any) => {
      // 1. Garantir que os buckets existem (sem conflito)
      await txRunner
        .insert(geocodingUsageBuckets)
        .values([
          {
            scope: "ACTOR",
            scopeId: actorId,
            windowType: "HOURLY",
            windowStart: hourStart,
            count: 0,
            expiresAt: hourExpiresAt,
          },
          {
            scope: "ACTOR",
            scopeId: actorId,
            windowType: "DAILY",
            windowStart: dayStart,
            count: 0,
            expiresAt: dayExpiresAt,
          },
        ])
        .onConflictDoNothing();

      // 2. Travar exatamente os pares (windowType, windowStart) do ator com FOR UPDATE
      const rows = await txRunner
        .select({
          windowType: geocodingUsageBuckets.windowType,
          windowStart: geocodingUsageBuckets.windowStart,
          count: geocodingUsageBuckets.count,
        })
        .from(geocodingUsageBuckets)
        .where(
          and(
            eq(geocodingUsageBuckets.scope, "ACTOR"),
            eq(geocodingUsageBuckets.scopeId, actorId),
            targetBucketsCondition,
          ),
        )
        .orderBy(
          asc(geocodingUsageBuckets.windowType),
          asc(geocodingUsageBuckets.windowStart),
        )
        .for("update");

      const hourCount =
        rows.find(
          (r: any) =>
            r.windowType === "HOURLY" &&
            new Date(r.windowStart).getTime() === hourStart.getTime(),
        )?.count ?? 0;
      const dayCount =
        rows.find(
          (r: any) =>
            r.windowType === "DAILY" &&
            new Date(r.windowStart).getTime() === dayStart.getTime(),
        )?.count ?? 0;

      if (hourCount >= limitPerHour || dayCount >= limitPerDay) {
        return false;
      }

      // 3. Incremento atômico garantido apenas para os dois buckets ativos sob lock exclusivo
      await txRunner
        .update(geocodingUsageBuckets)
        .set({ count: sql`${geocodingUsageBuckets.count} + 1` })
        .where(
          and(
            eq(geocodingUsageBuckets.scope, "ACTOR"),
            eq(geocodingUsageBuckets.scopeId, actorId),
            targetBucketsCondition,
          ),
        );

      return true;
    };

    if (tx) {
      return runInTx(tx);
    }

    return await this.database.transaction(async (innerTx: any) =>
      runInTx(innerTx),
    );
  }
}
