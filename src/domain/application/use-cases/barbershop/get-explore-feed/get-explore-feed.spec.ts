import { describe, it, expect, beforeEach } from "vitest";
import { GetExploreFeedUseCase } from "./get-explore-feed";
import type { DiscoveryRepository } from "../../../repositories/discovery-repository";
import type {
  DiscoveryInput,
  DiscoveryPage,
  PublicShop,
} from "../../../services/discovery-contract";
import { InvalidExploreCursorError } from "../../../services/explore-cursor-token";

class InMemoryDiscoveryRepository implements DiscoveryRepository {
  public isHealthy = true;
  public mockShops: PublicShop[] = [];

  async search(input: DiscoveryInput): Promise<DiscoveryPage> {
    let items = [...this.mockShops];
    if (input.q) {
      const q = input.q.toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q),
      );
    }

    return {
      items: items.slice(
        (input.page - 1) * input.limit,
        input.page * input.limit,
      ),
      page: input.page,
      limit: input.limit,
      total: items.length,
      hasNext: input.page * input.limit < items.length,
      serverTime: new Date().toISOString(),
    };
  }

  async isLocationServiceHealthy(): Promise<boolean> {
    return this.isHealthy;
  }
}

describe("GetExploreFeedUseCase", () => {
  let repository: InMemoryDiscoveryRepository;
  let sut: GetExploreFeedUseCase;

  beforeEach(() => {
    repository = new InMemoryDiscoveryRepository();
    sut = new GetExploreFeedUseCase(repository);

    repository.mockShops = [
      {
        id: "shop-1",
        name: "Barbearia Horizonte — Demonstração",
        slug: "barbearia-horizonte-demo",
        location: "Vila Mariana, São Paulo",
        avatarUrl: "https://example.com/logo1.png",
        featuredServices: [
          {
            id: "service-1",
            mediaId: "media-ready-1",
            title: "Corte",
            imageUrl: "https://example.com/service.webp",
            priceInCents: 5000,
            durationInMinutes: 30,
            featuredOrder: 0,
            width: 720,
            height: 1080,
          },
        ],
        coverUrl: "https://example.com/cover1.png",
        coordinates: { latitude: -23.58, longitude: -46.64 },
        distanceMeters: 1200,
        rating: 4.8,
        reviewCount: 45,
      },
      {
        id: "shop-2",
        name: "Barbearia Estação Mooca — Demonstração",
        slug: "barbearia-estacao-mooca-demo",
        location: "Mooca, São Paulo",
        avatarUrl: "https://example.com/logo2.png",
        coverUrl: "https://example.com/cover2.png",
        coordinates: { latitude: -23.55, longitude: -46.6 },
        distanceMeters: 4500,
        rating: 4.9,
        reviewCount: 90,
      },
      {
        id: "shop-3",
        name: "Barbearia Santana — Demonstração",
        slug: "barbearia-santana-demo",
        location: "Santana, São Paulo",
        avatarUrl: null,
        coverUrl: null,
        coordinates: { latitude: -23.5, longitude: -46.62 },
        distanceMeters: 11000,
        rating: 5.0,
        reviewCount: 120,
      },
    ];
  });

  it("deve retornar feed ranqueado com mídia correta por barbearia", async () => {
    const result = await sut.execute({
      mode: "NEARBY",
      point: { latitude: -23.57, longitude: -46.64 },
      radiusKm: 25,
      limit: 2,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      const page = result.value;
      expect(page.items).toHaveLength(2);
      expect(page.hasNext).toBe(true);
      expect(page.nextCursor).toBeDefined();

      // Loja mais próxima (1.2 km) lidera sobre a de 11 km
      expect(page.items[0].barbershop.name).toContain("Horizonte");
      expect(page.items[0].distanceBasis).toBe("user");
      expect(page.items[0].distanceMeters).toBe(1200);

      // Mídias da loja 1 devem ser serviços em destaque da barbearia com dados completos
      const media = page.items[0].media;
      expect(media.length).toBeGreaterThan(0);

      const serviceMedia = media.find((m) => m.kind === "service");
      expect(serviceMedia).toBeDefined();
      expect(serviceMedia?.service?.priceInCents).toBeGreaterThan(0);
      expect(serviceMedia?.service?.title).toBeDefined();
      expect(media.every((m) => m.kind === "service")).toBe(true);
    }
  });

  it("deve paginar a segunda fatia sem duplicar lojas ao passar o cursor", async () => {
    // Página 1
    const res1 = await sut.execute({
      mode: "ALL",
      limit: 2,
    });

    expect(res1.isRight()).toBe(true);
    if (!res1.isRight()) return;

    const page1 = res1.value;
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    // Página 2 com o cursor recebido
    const res2 = await sut.execute({
      mode: "ALL",
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(res2.isRight()).toBe(true);
    if (!res2.isRight()) return;

    const page2 = res2.value;
    expect(page2.items).toHaveLength(1);
    expect(page2.hasNext).toBe(false);
    expect(page2.nextCursor).toBeNull();

    // Nenhum item da página 1 pode aparecer na página 2
    const idsPage1 = new Set(page1.items.map((i) => i.barbershop.id));
    for (const item of page2.items) {
      expect(idsPage1.has(item.barbershop.id)).toBe(false);
    }
  });

  it("deve rejeitar cursor inválido ou adulterado", async () => {
    const result = await sut.execute({
      mode: "ALL",
      cursor: "cursor.adulterado.123",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(InvalidExploreCursorError);
    }
  });

  it("deve retornar LocationServiceUnavailableError quando serviço de localização falha em modo NEARBY", async () => {
    repository.isHealthy = false;

    const result = await sut.execute({
      mode: "NEARBY",
      point: { latitude: -23.55, longitude: -46.63 },
      radiusKm: 10,
    });

    expect(result.isLeft()).toBe(true);
  });
  it("preserva snapshot quando avaliações mudam entre páginas", async () => {
    repository.mockShops.forEach((shop) => {
      shop.distanceMeters = null;
      shop.reviewCount = 100;
    });
    repository.mockShops[0].rating = 5;
    repository.mockShops[1].rating = 4;
    repository.mockShops[2].rating = 3;
    const first = await sut.execute({ mode: "ALL", limit: 1 });
    if (first.isLeft()) throw first.value;
    repository.mockShops[2].rating = 5;
    repository.mockShops[2].reviewCount = 1000;
    const second = await sut.execute({
      mode: "ALL",
      limit: 1,
      cursor: first.value.nextCursor!,
    });
    if (second.isLeft()) throw second.value;
    expect(second.value.items[0].barbershop.id).toBe("shop-2");
    expect(second.value.snapshotExpiresAt).toBe(first.value.snapshotExpiresAt);
  });
  it("inclui candidatos além dos primeiros cinquenta antes de ranquear", async () => {
    const sample = repository.mockShops[0];
    repository.mockShops = Array.from({ length: 51 }, (_, i) => ({
      ...sample,
      id: `shop-${i}`,
      distanceMeters: null,
      rating: i === 50 ? 5 : 1,
      reviewCount: 100,
    }));
    const result = await sut.execute({ mode: "ALL", limit: 1 });
    if (result.isLeft()) throw result.value;
    expect(result.value.items[0].barbershop.id).toBe("shop-50");
    expect(result.value.total).toBe(51);
  });
  it("não inventa serviço para foto de ambiente", async () => {
    const shop = repository.mockShops[0];
    shop.featuredServices = [];
    shop.photos = ["https://example.com/environment.webp"];
    shop.environmentMedia=[{id:"ready-environment",url:shop.photos[0],width:720,height:1080,mimeType:"image/webp"}];
    const result = await sut.execute({
      mode: "NEARBY",
      point: { latitude: 0, longitude: 0 },
      limit: 1,
    });
    if (result.isLeft()) throw result.value;
    expect(result.value.items[0].media[0].kind).toBe("environment");
    expect(result.value.items[0].media[0].service).toBeNull();
  });
  it('não publica URL legada sem projeção de mídia pronta',async()=>{
    repository.mockShops.forEach(shop=>{shop.featuredServices=[];shop.environmentMedia=[];shop.photos=['https://example.com/unprocessed.jpg'];});
    const result=await sut.execute({mode:'ALL',limit:20});if(result.isLeft())throw result.value;
    expect(result.value.items.every(item=>item.media.length===0)).toBe(true);
  });

});
