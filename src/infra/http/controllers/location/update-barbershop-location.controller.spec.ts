import { describe, expect, it, vi } from "vitest";
import { UpdateBarbershopLocationController } from "./update-barbershop-location.controller";
import {
  type UpdateBarbershopLocationUseCase,
  LocationConflictError,
} from "../../../../domain/application/use-cases/location/update-barbershop-location/update-barbershop-location";
import { right, left } from "../../../../core/logic/either";

describe("UpdateBarbershopLocationController", () => {
  it("deve retornar 200 com localização atualizada", async () => {
    const fakeUseCase = {
      execute: vi.fn().mockResolvedValue(
        right({
          shopId: "22222222-2222-4222-8222-222222222222",
          address: "Av Paulista, 1500",
          status: "CONFIRMED",
          source: "GOOGLE",
          version: 2,
          point: { latitude: -23.5, longitude: -46.6 },
          confirmedAt: new Date().toISOString(),
          acquiredAt: new Date().toISOString(),
          validUntil: new Date().toISOString(),
          lastOwnerMutation: { id: "mut-1", commandHash: "h", savedVersion: 2 },
        }),
      ),
    } as unknown as UpdateBarbershopLocationUseCase;

    const controller = new UpdateBarbershopLocationController(fakeUseCase);
    const response = await controller.handle({
      shopId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      address: "Av Paulista, 1500",
      candidateId: "33333333-3333-4333-8333-333333333333",
      latitude: -23.5,
      longitude: -46.6,
      expectedVersion: 1,
      mutationId: "mut-1",
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).version).toBe(2);
  });

  it("deve retornar 409 em caso de LOCATION_VERSION_CONFLICT", async () => {
    const fakeUseCase = {
      execute: vi
        .fn()
        .mockResolvedValue(
          left(
            new LocationConflictError(
              "LOCATION_VERSION_CONFLICT",
              "Versão divergente.",
            ),
          ),
        ),
    } as unknown as UpdateBarbershopLocationUseCase;

    const controller = new UpdateBarbershopLocationController(fakeUseCase);
    const response = await controller.handle({
      shopId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      address: "Av Paulista, 1500",
      candidateId: "33333333-3333-4333-8333-333333333333",
      latitude: -23.5,
      longitude: -46.6,
      expectedVersion: 0,
      mutationId: "mut-1",
    });

    expect(response.statusCode).toBe(409);
    expect((response.body as any).code).toBe("LOCATION_VERSION_CONFLICT");
  });
});
