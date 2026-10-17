import { describe, expect, it, vi } from "vitest";
import { SearchGeocodingAddressController } from "./search-geocoding-address.controller";
import type { SearchGeocodingAddressUseCase } from "../../../../domain/application/use-cases/location/search-geocoding-address/search-geocoding-address";
import { right, left } from "../../../../core/logic/either";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";

describe("SearchGeocodingAddressController", () => {
  it("deve retornar 200 com candidatos", async () => {
    const fakeUseCase = {
      execute: vi.fn().mockResolvedValue(
        right({
          candidates: [
            {
              candidateId: "cand-1",
              displayAddress: "Av Paulista, 1000",
              point: { latitude: -23.5, longitude: -46.6 },
              expiresAt: new Date().toISOString(),
              attribution: "Google Maps",
            },
          ],
        }),
      ),
    } as unknown as SearchGeocodingAddressUseCase;

    const controller = new SearchGeocodingAddressController(fakeUseCase);
    const response = await controller.handle({
      userId: "11111111-1111-4111-8111-111111111111",
      address: "Av Paulista, 1000",
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).candidates).toHaveLength(1);
    expect((response.body as any).serverTime).toBeDefined();
  });

  it("deve retornar 400 em caso de erro de validação Zod", async () => {
    const fakeUseCase = {
      execute: vi.fn(),
    } as unknown as SearchGeocodingAddressUseCase;
    const controller = new SearchGeocodingAddressController(fakeUseCase);

    const response = await controller.handle({
      userId: "invalid-uuid",
      address: "a", // curto
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as any).code).toBe("VALIDATION_ERROR");
  });

  it("deve retornar 403 se o ator não tiver permissão", async () => {
    const fakeUseCase = {
      execute: vi
        .fn()
        .mockResolvedValue(
          left(new NotAllowedError("Apenas o proprietário ativo.")),
        ),
    } as unknown as SearchGeocodingAddressUseCase;

    const controller = new SearchGeocodingAddressController(fakeUseCase);
    const response = await controller.handle({
      userId: "11111111-1111-4111-8111-111111111111",
      address: "Av Paulista, 1000",
    });

    expect(response.statusCode).toBe(403);
    expect((response.body as any).code).toBe("FORBIDDEN");
  });
});
