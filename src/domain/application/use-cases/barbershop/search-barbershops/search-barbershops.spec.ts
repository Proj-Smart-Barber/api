import { describe, expect, it } from "vitest";
import type { DiscoveryRepository } from "../../../repositories/discovery-repository";
import type {
  DiscoveryInput,
  DiscoveryPage,
} from "../../../services/discovery-contract";
import { SearchBarbershopsUseCase } from "./search-barbershops";
import { LocationServiceUnavailableError } from "../../_errors/location-service-unavailable-error";

class InMemoryDiscoveryRepository implements DiscoveryRepository {
  public isHealthy = true;
  public searchCalls: DiscoveryInput[] = [];

  async search(input: DiscoveryInput): Promise<DiscoveryPage> {
    this.searchCalls.push(input);
    return {
      items: [
        {
          id: "1",
          name: "Barbearia Teste",
          slug: "barbearia-teste",
          location: "Rua A, 100",
          avatarUrl: null,
          coordinates:
            input.mode === "NEARBY" ? { latitude: 0, longitude: 0 } : null,
          distanceMeters: input.mode === "NEARBY" ? 500 : null,
        },
      ],
      page: input.page,
      limit: input.limit,
      total: 1,
      hasNext: false,
      serverTime: new Date().toISOString(),
    };
  }

  async isLocationServiceHealthy(): Promise<boolean> {
    return this.isHealthy;
  }
}

describe("SearchBarbershopsUseCase (Unit)", () => {
  it("searches in ALL mode and returns right with page", async () => {
    const repo = new InMemoryDiscoveryRepository();
    const useCase = new SearchBarbershopsUseCase(repo);

    const result = await useCase.execute({
      mode: "ALL",
      q: "Teste",
      page: 1,
      limit: 20,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0].name).toBe("Barbearia Teste");
      expect(result.value.items[0].distanceMeters).toBeNull();
    }
  });

  it("searches in NEARBY mode and returns right when service is healthy", async () => {
    const repo = new InMemoryDiscoveryRepository();
    repo.isHealthy = true;
    const useCase = new SearchBarbershopsUseCase(repo);

    const result = await useCase.execute({
      mode: "NEARBY",
      point: { latitude: -23.55, longitude: -46.63 },
      radiusKm: 10,
      page: 1,
      limit: 20,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0].distanceMeters).toBe(500);
    }
  });

  it("returns LocationServiceUnavailableError when NEARBY mode is called and service is unhealthy", async () => {
    const repo = new InMemoryDiscoveryRepository();
    repo.isHealthy = false;
    const useCase = new SearchBarbershopsUseCase(repo);

    const result = await useCase.execute({
      mode: "NEARBY",
      point: { latitude: -23.55, longitude: -46.63 },
      radiusKm: 10,
      page: 1,
      limit: 20,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(LocationServiceUnavailableError);
    }
    expect(repo.searchCalls).toHaveLength(0);
  });

  it("allows ALL mode search even when location maintenance is unhealthy", async () => {
    const repo = new InMemoryDiscoveryRepository();
    repo.isHealthy = false;
    const useCase = new SearchBarbershopsUseCase(repo);

    const result = await useCase.execute({
      mode: "ALL",
      page: 1,
      limit: 20,
    });

    expect(result.isRight()).toBe(true);
    expect(repo.searchCalls).toHaveLength(1);
  });
});
