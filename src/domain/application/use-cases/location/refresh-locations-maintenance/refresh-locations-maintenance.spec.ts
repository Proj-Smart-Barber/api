import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshLocationsMaintenanceUseCase } from "./refresh-locations-maintenance";
import { InMemoryGeocodingCandidatesRepository } from "../../../../../../test/repositories/in-memory-geocoding-candidates-repository";

describe("RefreshLocationsMaintenanceUseCase", () => {
  let sut: RefreshLocationsMaintenanceUseCase;
  let candidatesRepository: InMemoryGeocodingCandidatesRepository;
  let fakeDb: any;

  beforeEach(() => {
    candidatesRepository = new InMemoryGeocodingCandidatesRepository();

    fakeDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "loc-1" }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    sut = new RefreshLocationsMaintenanceUseCase(candidatesRepository, fakeDb);
  });

  it("deve executar a varredura, limpar candidatos expirados e registrar heartbeat de saúde", async () => {
    // Inserir candidato expirado
    candidatesRepository.items.push({
      id: "cand-expired",
      actorId: "actor-1",
      barbershopId: "shop-1",
      addressHash: "hash-1",
      latitude: -23.55052,
      longitude: -46.633308,
      placeId: "place-1",
      expiresAt: new Date(Date.now() - 60000), // Expirado há 1 minuto
      consumedAt: null,
      createdAt: new Date(),
    });

    const result = await sut.execute();

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("OK");
      expect(result.value.deletedCandidatesCount).toBe(1);
      expect(result.value.sweptLocationsCount).toBe(1);
      expect(result.value.heartbeatAt).toBeDefined();
    }

    expect(fakeDb.update).toHaveBeenCalled();
    expect(fakeDb.insert).toHaveBeenCalled();
  });
});
