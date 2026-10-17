import { describe, expect, it, vi } from "vitest";
import { GetBarbershopLocationController } from "./get-barbershop-location.controller";
import type { GetBarbershopLocationUseCase } from "../../../../domain/application/use-cases/location/get-barbershop-location/get-barbershop-location";
import { right, left } from "../../../../core/logic/either";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";

describe("GetBarbershopLocationController", () => {
  it("deve retornar 200 com o estado da localização", async () => {
    const fakeUseCase = {
      execute: vi.fn().mockResolvedValue(
        right({
          shopId: "22222222-2222-4222-8222-222222222222",
          address: "Rua Augusta, 100",
          status: "CONFIRMED",
          source: "GOOGLE",
          version: 1,
          point: { latitude: -23.5, longitude: -46.6 },
          confirmedAt: new Date().toISOString(),
          acquiredAt: new Date().toISOString(),
          validUntil: new Date().toISOString(),
          lastOwnerMutation: null,
        }),
      ),
    } as unknown as GetBarbershopLocationUseCase;

    const controller = new GetBarbershopLocationController(fakeUseCase);
    const response = await controller.handle({
      shopId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).status).toBe("CONFIRMED");
    expect((response.body as any).version).toBe(1);
  });

  it("deve retornar 403 se o ator não for o proprietário", async () => {
    const fakeUseCase = {
      execute: vi
        .fn()
        .mockResolvedValue(left(new NotAllowedError("Apenas o proprietário."))),
    } as unknown as GetBarbershopLocationUseCase;

    const controller = new GetBarbershopLocationController(fakeUseCase);
    const response = await controller.handle({
      shopId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.statusCode).toBe(403);
    expect((response.body as any).code).toBe("FORBIDDEN");
  });

  it("deve retornar 404 se a barbearia não existir", async () => {
    const fakeUseCase = {
      execute: vi
        .fn()
        .mockResolvedValue(
          left(new ResourceNotFoundError("Barbearia não encontrada.")),
        ),
    } as unknown as GetBarbershopLocationUseCase;

    const controller = new GetBarbershopLocationController(fakeUseCase);
    const response = await controller.handle({
      shopId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.statusCode).toBe(404);
    expect((response.body as any).code).toBe("NOT_FOUND");
  });
});
