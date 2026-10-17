import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  unauthorized,
  fail,
} from "../../../../core/infra/http-response";
import type { RefreshLocationsMaintenanceUseCase } from "../../../../domain/application/use-cases/location/refresh-locations-maintenance/refresh-locations-maintenance";

export class RefreshLocationsMaintenanceController implements Controller {
  constructor(
    private refreshLocationsMaintenanceUseCase: RefreshLocationsMaintenanceUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader =
        request.headers?.authorization || request.headers?.Authorization;

      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return unauthorized({
          code: "UNAUTHORIZED",
          message: "Acesso não autorizado ao endpoint interno de manutenção.",
          error: {
            code: "UNAUTHORIZED",
            message: "Acesso não autorizado ao endpoint interno de manutenção.",
          },
        });
      }

      const result = await this.refreshLocationsMaintenanceUseCase.execute();

      if (result.isLeft()) {
        return clientError({
          code: "MAINTENANCE_ERROR",
          message: result.value.message,
          error: { code: "MAINTENANCE_ERROR", message: result.value.message },
        });
      }

      return ok(result.value);
    } catch (err: unknown) {
      return fail(err as Error);
    }
  }
}
