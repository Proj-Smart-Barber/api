import { describe, it, expect, vi, beforeEach } from "vitest";
import { DrizzleDiscoveryRepository } from "../src/infra/drizzle/repositories/drizzle-discovery-repository";
import { SearchBarbershopsUseCase } from "../src/domain/application/use-cases/barbershop/search-barbershops/search-barbershops";
import { GetExploreFeedUseCase } from "../src/domain/application/use-cases/barbershop/get-explore-feed/get-explore-feed";
import { LocationServiceUnavailableError } from "../src/domain/application/use-cases/_errors/location-service-unavailable-error";

describe("Política de Localização por Fonte e Desacoplamento de Saúde de Cache", () => {
  describe("DrizzleDiscoveryRepository - Saúde e Políticas de Elegibilidade", () => {
    it("isLocationServiceHealthy deve retornar true quando o banco executa SELECT 1 com sucesso", async () => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
      };
      const repo = new DrizzleDiscoveryRepository(mockDb);

      const healthy = await repo.isLocationServiceHealthy();
      expect(healthy).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it("isLocationServiceHealthy deve retornar false quando a consulta ao banco falha (conexão rompida)", async () => {
      const mockDb = {
        execute: vi.fn().mockRejectedValue(new Error("Connection terminated")),
      };
      const repo = new DrizzleDiscoveryRepository(mockDb);

      const healthy = await repo.isLocationServiceHealthy();
      expect(healthy).toBe(false);
    });

    it("isGoogleMapsCacheHealthy deve retornar false quando não há registro recente em location_maintenance_health", async () => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue({ rows: [] }),
      };
      const repo = new DrizzleDiscoveryRepository(mockDb);

      const healthy = await repo.isGoogleMapsCacheHealthy();
      expect(healthy).toBe(false);
    });

    it("isGoogleMapsCacheHealthy deve retornar true quando há heartbeat saudável nos últimos 36h", async () => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue({
          rows: [{ is_healthy: true, last_heartbeat_at: new Date().toISOString() }],
        }),
      };
      const repo = new DrizzleDiscoveryRepository(mockDb);

      const healthy = await repo.isGoogleMapsCacheHealthy();
      expect(healthy).toBe(true);
    });

    it("searchNearby deve retornar 200 OK com total=0 e items=[] quando não houver barbearias no raio", async () => {
      const mockDb = {
        execute: vi.fn().mockImplementation((query) => {
          const sqlText = query.queryChunks?.[0]?.toString?.() ?? String(query);
          // Query para isGoogleMapsCacheHealthy
          if (sqlText.includes("location_maintenance_health")) {
            return Promise.resolve({ rows: [] });
          }
          // Query para contagem total
          if (sqlText.includes("COUNT(*)")) {
            return Promise.resolve({ rows: [{ total: 0 }] });
          }
          // Query para linhas
          return Promise.resolve({ rows: [] });
        }),
      };
      const repo = new DrizzleDiscoveryRepository(mockDb);

      const result = await repo.search({
        mode: "NEARBY",
        point: { latitude: -23.55052, longitude: -46.633308 },
        radiusKm: 5,
        page: 1,
        limit: 20,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasNext).toBe(false);
      expect(result.page).toBe(1);
    });
  });

  describe("Use Cases - Comportamento com Falha do Serviço vs Cache do Google", () => {
    it("GetExploreFeedUseCase deve retornar LocationServiceUnavailableError (503) apenas se o motor de coordenadas estiver inacessível", async () => {
      const repo = {
        isLocationServiceHealthy: vi.fn().mockResolvedValue(false),
        search: vi.fn(),
      };
      const useCase = new GetExploreFeedUseCase(repo as any);

      const result = await useCase.execute({
        mode: "NEARBY",
        point: { latitude: -23.55, longitude: -46.63 },
        radiusKm: 10,
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value).toBeInstanceOf(LocationServiceUnavailableError);
      }
      expect(repo.search).not.toHaveBeenCalled();
    });

    it("GetExploreFeedUseCase deve executar a busca quando o motor de coordenadas estiver saudável, retornando lista vazia se zero resultados", async () => {
      const repo = {
        isLocationServiceHealthy: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockResolvedValue({
          items: [],
          page: 1,
          limit: 50,
          total: 0,
          hasNext: false,
          serverTime: new Date().toISOString(),
        }),
      };
      const useCase = new GetExploreFeedUseCase(repo as any);

      const result = await useCase.execute({
        mode: "NEARBY",
        point: { latitude: -23.55, longitude: -46.63 },
        radiusKm: 10,
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.items).toEqual([]);
        expect(result.value.nextCursor).toBeNull();
      }
      expect(repo.search).toHaveBeenCalledTimes(1);
    });

    it("SearchBarbershopsUseCase deve retornar sucesso com coordenadas de barbearias manuais preservadas quando o serviço de banco está saudável", async () => {
      const repo = {
        isLocationServiceHealthy: vi.fn().mockResolvedValue(true),
        search: vi.fn().mockResolvedValue({
          items: [
            {
              id: "shop-1",
              name: "Barbearia Horizonte — Demonstração",
              slug: "barbearia-horizonte-demo",
              location: "República, SP",
              coordinates: { latitude: -23.5442, longitude: -46.64 },
              distanceMeters: null,
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          hasNext: false,
          serverTime: new Date().toISOString(),
        }),
      };
      const useCase = new SearchBarbershopsUseCase(repo as any);

      const result = await useCase.execute({
        mode: "ALL",
        page: 1,
        limit: 20,
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0].coordinates).toEqual({
          latitude: -23.5442,
          longitude: -46.64,
        });
      }
    });
  });
});
