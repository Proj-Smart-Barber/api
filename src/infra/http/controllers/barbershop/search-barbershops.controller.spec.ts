import { describe, expect, it } from "vitest";
import { right, left } from "../../../../core/logic/either";
import { LocationServiceUnavailableError } from "../../../../domain/application/use-cases/_errors/location-service-unavailable-error";
import type { SearchBarbershopsUseCase } from "../../../../domain/application/use-cases/barbershop/search-barbershops/search-barbershops";
import {
  SearchBarbershopsController,
  SearchNearbyBarbershopsController,
} from "./search-barbershops.controller";

const fakePage = {
  items: [
    {
      id: "shop-1",
      name: "Barbearia Exemplo",
      slug: "barbearia-exemplo",
      location: "Av Paulista, 1000",
      avatarUrl: null,
      coordinates: null,
      distanceMeters: null,
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
  hasNext: false,
  serverTime: new Date().toISOString(),
};

describe("SearchBarbershopsController (Unit)", () => {
  it("returns 200 ok with defaults for empty query in ALL mode", async () => {
    let capturedInput: any = null;
    const fakeUseCase = {
      execute: async (input: any) => {
        capturedInput = input;
        return right(fakePage);
      },
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchBarbershopsController(fakeUseCase);
    const response = await controller.handle({});

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(fakePage);
    expect(capturedInput).toEqual({
      mode: "ALL",
      q: undefined,
      page: 1,
      limit: 20,
    });
  });

  it("trims and accepts q query parameter", async () => {
    let capturedInput: any = null;
    const fakeUseCase = {
      execute: async (input: any) => {
        capturedInput = input;
        return right(fakePage);
      },
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchBarbershopsController(fakeUseCase);
    const response = await controller.handle({
      q: "  Corte Clássico  ",
      page: "2",
      limit: "10",
    });

    expect(response.statusCode).toBe(200);
    expect(capturedInput.q).toBe("Corte Clássico");
    expect(capturedInput.page).toBe(2);
    expect(capturedInput.limit).toBe(10);
  });

  it("rejects coordinates on GET /api/barbershops with 400", async () => {
    const fakeUseCase = {
      execute: async () => right(fakePage),
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchBarbershopsController(fakeUseCase);
    const response = await controller.handle({
      latitude: -23.55,
      longitude: -46.63,
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as any).error).toContain(
      "Coordenadas não são permitidas nesta rota",
    );
  });

  it("rejects invalid page and limit values with 400", async () => {
    const fakeUseCase = {
      execute: async () => right(fakePage),
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchBarbershopsController(fakeUseCase);

    const res1 = await controller.handle({ page: "0" });
    expect(res1.statusCode).toBe(400);

    const res2 = await controller.handle({ limit: "51" });
    expect(res2.statusCode).toBe(400);

    const res3 = await controller.handle({ page: "abc" });
    expect(res3.statusCode).toBe(400);
  });
});

describe("SearchNearbyBarbershopsController (Unit)", () => {
  it("returns 200 ok for valid coordinates and supported radius", async () => {
    let capturedInput: any = null;
    const fakeUseCase = {
      execute: async (input: any) => {
        capturedInput = input;
        return right({
          ...fakePage,
          items: [
            {
              ...fakePage.items[0],
              coordinates: { latitude: -23.55, longitude: -46.63 },
              distanceMeters: 1250,
            },
          ],
        });
      },
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchNearbyBarbershopsController(fakeUseCase);
    const response = await controller.handle({
      latitude: -23.55052,
      longitude: -46.633308,
      radiusKm: 10,
      q: "Vintage",
    });

    expect(response.statusCode).toBe(200);
    expect(capturedInput.mode).toBe("NEARBY");
    expect(capturedInput.point).toEqual({
      latitude: -23.55052,
      longitude: -46.633308,
    });
    expect(capturedInput.radiusKm).toBe(10);
    expect(capturedInput.q).toBe("Vintage");
    expect(capturedInput.page).toBe(1);
    expect(capturedInput.limit).toBe(20);
  });

  it("rejects unsupported radius values (only 5, 10, 25, 50 allowed)", async () => {
    const fakeUseCase = {
      execute: async () => right(fakePage),
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchNearbyBarbershopsController(fakeUseCase);
    const response = await controller.handle({
      latitude: -23.55,
      longitude: -46.63,
      radiusKm: 15,
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects out-of-range coordinates with 400", async () => {
    const fakeUseCase = {
      execute: async () => right(fakePage),
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchNearbyBarbershopsController(fakeUseCase);

    const res1 = await controller.handle({
      latitude: 91,
      longitude: 0,
      radiusKm: 5,
    });
    expect(res1.statusCode).toBe(400);

    const res2 = await controller.handle({
      latitude: 0,
      longitude: -181,
      radiusKm: 5,
    });
    expect(res2.statusCode).toBe(400);
  });

  it("rejects NaN or Infinity coordinates with 400", async () => {
    const fakeUseCase = {
      execute: async () => right(fakePage),
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchNearbyBarbershopsController(fakeUseCase);

    const res1 = await controller.handle({
      latitude: Number.NaN,
      longitude: 0,
      radiusKm: 5,
    });
    expect(res1.statusCode).toBe(400);

    const res2 = await controller.handle({
      latitude: 0,
      longitude: Number.POSITIVE_INFINITY,
      radiusKm: 5,
    });
    expect(res2.statusCode).toBe(400);
  });

  it("returns 503 when location service is unavailable", async () => {
    const fakeUseCase = {
      execute: async () => left(new LocationServiceUnavailableError()),
    } as unknown as SearchBarbershopsUseCase;

    const controller = new SearchNearbyBarbershopsController(fakeUseCase);
    const response = await controller.handle({
      latitude: 0,
      longitude: 0,
      radiusKm: 25,
    });

    expect(response.statusCode).toBe(503);
    expect((response.body as any).error).toContain(
      "Serviço de busca por proximidade temporariamente indisponível",
    );
  });
});
