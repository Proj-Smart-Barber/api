import { type Either, right } from "../../../../../core/logic/either";
import type { GeocodingCandidatesRepository } from "../../../repositories/geocoding-candidates-repository";
import { db } from "../../../../../infra/drizzle";
import {
  barbershopLocations,
  locationMaintenanceHealth,
} from "../../../../../infra/drizzle/schema";
import { and, eq, lte, sql } from "drizzle-orm";

export interface RefreshLocationsMaintenanceSuccess {
  status: "OK";
  sweptLocationsCount: number;
  deletedCandidatesCount: number;
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

    // 1. Limpeza de candidatos de geocodificação expirados
    const deletedCandidatesCount =
      await this.candidatesRepository.deleteExpired(now);

    // 2. Limpeza/transição de localizações Google vencidas (Resolução S3: margem de 25 dias)
    // Localizações com validade expirada retornam para busca textual (status NEEDS_REVIEW e coordenadas limpas)
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
        ),
      )
      .returning({ id: barbershopLocations.id });

    const sweptLocationsCount = sweptRows.length;

    // 3. Atualizar saúde e heartbeat do componente google_maps_cache
    await this.database
      .insert(locationMaintenanceHealth)
      .values({
        component: "google_maps_cache",
        isHealthy: true,
        lastHeartbeatAt: now,
        consecutiveFailures: 0,
        details: `Ciclo de manutenção executado: ${deletedCandidatesCount} candidatos descartados, ${sweptLocationsCount} locais atualizados.`,
      })
      .onConflictDoUpdate({
        target: [locationMaintenanceHealth.component],
        set: {
          isHealthy: true,
          lastHeartbeatAt: now,
          consecutiveFailures: 0,
          details: `Ciclo de manutenção executado: ${deletedCandidatesCount} candidatos descartados, ${sweptLocationsCount} locais atualizados.`,
          updatedAt: now,
        },
      });

    return right({
      status: "OK",
      sweptLocationsCount,
      deletedCandidatesCount,
      heartbeatAt: now.toISOString(),
    });
  }
}
