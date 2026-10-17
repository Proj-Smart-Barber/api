import { describe, expect, it, vi } from "vitest";
import { RefreshLocationsMaintenanceController } from "./refresh-locations-maintenance.controller";
import type { RefreshLocationsMaintenanceUseCase } from "../../../../domain/application/use-cases/location/refresh-locations-maintenance/refresh-locations-maintenance";
import { right } from "../../../../core/logic/either";

describe("RefreshLocationsMaintenanceController", () => {
  it("deve retornar 200 com resumo se o Bearer CRON_SECRET for válido", async () => {
    process.env.CRON_SECRET = "secret-token-123";

    const fakeUseCase = {
      execute: vi.fn().mockResolvedValue(
        right({
          status: "OK",
          sweptLocationsCount: 2,
          deletedCandidatesCount: 10,
          heartbeatAt: new Date().toISOString(),
        }),
      ),
    } as unknown as RefreshLocationsMaintenanceUseCase;

    const controller = new RefreshLocationsMaintenanceController(fakeUseCase);
    const response = await controller.handle({
      headers: {
        authorization: "Bearer secret-token-123",
      },
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).status).toBe("OK");
    expect((response.body as any).sweptLocationsCount).toBe(2);
  });

  it("deve retornar 401 se o Bearer token for inválido ou ausente", async () => {
    process.env.CRON_SECRET = "secret-token-123";

    const fakeUseCase = {
      execute: vi.fn(),
    } as unknown as RefreshLocationsMaintenanceUseCase;
    const controller = new RefreshLocationsMaintenanceController(fakeUseCase);

    const response = await controller.handle({
      headers: {
        authorization: "Bearer token-errado",
      },
    });

    expect(response.statusCode).toBe(401);
    expect((response.body as any).code).toBe("UNAUTHORIZED");
  });
});
