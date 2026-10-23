import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  unauthorized,
  fail,
} from "../../../../core/infra/http-response";
import type { StorageCleanupService } from "../../../../domain/application/services/storage-cleanup-service";

export class StorageCleanupController implements Controller {
  constructor(private storageCleanupService: StorageCleanupService) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader =
        request.headers?.authorization || request.headers?.Authorization;

      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return unauthorized({
          code: "UNAUTHORIZED",
          message: "Acesso não autorizado ao endpoint interno de manutenção de storage.",
          error: {
            code: "UNAUTHORIZED",
            message: "Acesso não autorizado ao endpoint interno de manutenção de storage.",
          },
        });
      }

      const result = await this.storageCleanupService.execute();

      return ok({
        message: "Manutenção de storage executada com sucesso.",
        cleanedCount: result.cleanedCount,
        errors: result.errors,
      });
    } catch (err: unknown) {
      return fail(err as Error);
    }
  }
}
