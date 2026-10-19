import { type Either, left, right } from "../../../../../core/logic/either";
import type { GeocodingCandidatesRepository } from "../../../repositories/geocoding-candidates-repository";
import { db } from "../../../../../infra/drizzle";
import {
  barbershopLocations,
  geocodingUsageBuckets,
  locationMaintenanceHealth,
} from "../../../../../infra/drizzle/schema";
import { and, eq, lte, sql } from "drizzle-orm";

export interface RefreshLocationsMaintenanceSuccess {
  status: "OK";
  sweptLocationsCount: number;
  deletedCandidatesCount: number;
  deletedBucketsCount: number;
  heartbeatAt: string;
}

export type RefreshLocationsMaintenanceResponse = Either<
  Error,
  RefreshLocationsMaintenanceSuccess
>;

export class RefreshLocationsMaintenanceUseCase {
  constructor(
    private candidatesRepository: GeocodingCandidatesRepository,
    // biome-ignore lint/suspicious/noExplicitAny: supports custom db for testing
    private customDb?: any,
  ) {}

  private get database(): any {
    return this.customDb ?? db;
  }

  async execute(): Promise<RefreshLocationsMaintenanceResponse> {
    const now = new Date();

    try {
      // 1. Limpeza de candidatos de geocodificação expirados (em lote de até 500)
      const deletedCandidatesCount =
        await this.candidatesRepository.deleteExpired(now);

      // 2. Limpeza de buckets de quota expirados (em lote de até 500)
      const deletedBucketsResult = await this.database
        .delete(geocodingUsageBuckets)
        .where(
          and(
            lte(geocodingUsageBuckets.expiresAt, now),
            sql`${geocodingUsageBuckets.id} IN (
              SELECT id FROM ${geocodingUsageBuckets}
              WHERE ${geocodingUsageBuckets.expiresAt} <= ${now}
              LIMIT 500
            )`,
          ),
        )
        .returning({ id: geocodingUsageBuckets.id });
      const deletedBucketsCount = deletedBucketsResult.length;

      // 3. Limpeza/transição de localizações Google vencidas em lotes de até 100
      // Revalida source = 'GOOGLE' e valid_until <= now na cláusula externa do UPDATE
      // para não invalidar uma confirmação mais nova ocorrida em corrida concorrente.
      const sweptRows = await this.database
        .update(barbershopLocations)
        .set({
          status: "NEEDS_REVIEW",
          latitude: null,
          longitude: null,
          validUntil: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(barbershopLocations.source, "GOOGLE"),
            lte(barbershopLocations.validUntil, now),
            sql`${barbershopLocations.id} IN (
              SELECT id FROM ${barbershopLocations}
              WHERE ${barbershopLocations.source} = 'GOOGLE'
                AND ${barbershopLocations.validUntil} <= ${now}
              LIMIT 100
            )`,
          ),
        )
        .returning({ id: barbershopLocations.id });

      const sweptLocationsCount = sweptRows.length;

      // 4. Registrar heartbeat saudável de execução de manutenção
      await this.database
        .insert(locationMaintenanceHealth)
        .values({
          component: "google_maps_cache",
          isHealthy: true,
          lastHeartbeatAt: now,
          consecutiveFailures: 0,
          details: `Ciclo de manutenção: ${deletedCandidatesCount} candidatos descartados, ${deletedBucketsCount} buckets purgados, ${sweptLocationsCount} locais atualizados.`,
        })
        .onConflictDoUpdate({
          target: [locationMaintenanceHealth.component],
          set: {
            isHealthy: true,
            lastHeartbeatAt: now,
            consecutiveFailures: 0,
            details: `Ciclo de manutenção: ${deletedCandidatesCount} candidatos descartados, ${deletedBucketsCount} buckets purgados, ${sweptLocationsCount} locais atualizados.`,
            updatedAt: now,
          },
        });

      return right({
        status: "OK",
        sweptLocationsCount,
        deletedCandidatesCount,
        deletedBucketsCount,
        heartbeatAt: now.toISOString(),
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      try {
        await this.database
          .insert(locationMaintenanceHealth)
          .values({
            component: "google_maps_cache",
            isHealthy: false,
            lastFailureAt: now,
            consecutiveFailures: 1,
            details: `Falha no ciclo de manutenção: ${error.message}`,
          })
          .onConflictDoUpdate({
            target: [locationMaintenanceHealth.component],
            set: {
              isHealthy: false,
              lastFailureAt: now,
              consecutiveFailures: sql`${locationMaintenanceHealth.consecutiveFailures} + 1`,
              details: `Falha no ciclo de manutenção: ${error.message}`,
              updatedAt: now,
            },
          });
      } catch {
        // Ignora erro secundário ao registrar telemetria de falha
      }
      return left(error);
    }
  }
}
