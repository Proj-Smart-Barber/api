import { describe, it, expect, beforeEach } from "vitest";
import { ExploreFeedController } from "./explore-feed.controller";
import { GetExploreFeedUseCase } from "../../../../domain/application/use-cases/barbershop/get-explore-feed/get-explore-feed";
import type { DiscoveryRepository } from "../../../../domain/application/repositories/discovery-repository";
import type {
  DiscoveryInput,
  DiscoveryPage,
} from "../../../../domain/application/services/discovery-contract";

class StubDiscoveryRepo implements DiscoveryRepository {
  public isHealthy = true;
  async search(_input: DiscoveryInput): Promise<DiscoveryPage> {
    return {
      items: [
        {
          id: "shop-test-1",
          name: "Barbearia Estação Mooca — Demonstração",
          slug: "barbearia-estacao-mooca-demo",
          location: "Mooca, São Paulo",
          avatarUrl: "https://example.com/logo.png",
          coverUrl: "https://example.com/cover.png",
          photos: ["https://example.com/cover.png"],
          environmentMedia:[{id:"media-ready",url:"https://example.com/cover.png",width:720,height:1080,mimeType:"image/png"}],
          coordinates: { latitude: -23.55, longitude: -46.6 },
          distanceMeters: 800,
          rating: 4.9,
          reviewCount: 30,
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
      hasNext: false,
      serverTime: new Date().toISOString(),
    };
  }
  async isLocationServiceHealthy(): Promise<boolean> {
    return this.isHealthy;
  }
}

describe("ExploreFeedController", () => {
  let repo: StubDiscoveryRepo;
  let useCase: GetExploreFeedUseCase;
  let sut: ExploreFeedController;

  beforeEach(() => {
    repo = new StubDiscoveryRepo();
    useCase = new GetExploreFeedUseCase(repo);
    sut = new ExploreFeedController(useCase);
  });

  it("deve retornar HTTP 200 com items, rankingScore e mídias no modo ALL", async () => {
    const response = await sut.handle({
      mode: "ALL",
      limit: 5,
    });

    const body = response.body as any;
    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].barbershop.name).toContain("Estação");
    expect(body.items[0].rankingScore).toBeDefined();
    expect(body.items[0].media.length).toBeGreaterThan(0);
    expect(body.rankingVersion).toBeDefined();
  });

  it("deve retornar HTTP 200 com distanceBasis user no modo NEARBY com coordenadas válidas", async () => {
    const response = await sut.handle({
      mode: "NEARBY",
      latitude: -23.55052,
      longitude: -46.633308,
      radiusKm: 10,
    });

    const body = response.body as any;
    expect(response.statusCode).toBe(200);
    expect(body.items[0].distanceBasis).toBe("user");
    expect(body.items[0].distanceMeters).toBe(800);
  });

  it("deve retornar HTTP 400 se modo NEARBY for enviado sem latitude/longitude", async () => {
    const response = await sut.handle({
      mode: "NEARBY",
      radiusKm: 10,
    });

    const body = response.body as any;
    expect(response.statusCode).toBe(400);
    expect(body.error).toContain("Latitude e Longitude são obrigatórias");
  });

  it("deve retornar HTTP 400 com código INVALID_CURSOR ao enviar cursor adulterado", async () => {
    const response = await sut.handle({
      mode: "ALL",
      cursor: "token.invalido.123",
    });

    const body = response.body as any;
    expect(response.statusCode).toBe(400);
    expect(body.code).toBe("INVALID_CURSOR");
  });

  it("deve retornar HTTP 503 com código LOCATION_UNAVAILABLE quando serviço estiver indisponível no NEARBY", async () => {
    repo.isHealthy = false;

    const response = await sut.handle({
      mode: "NEARBY",
      latitude: -23.55,
      longitude: -46.63,
    });

    const body = response.body as any;
    expect(response.statusCode).toBe(503);
    expect(body.code).toBe("LOCATION_UNAVAILABLE");
  });
});
