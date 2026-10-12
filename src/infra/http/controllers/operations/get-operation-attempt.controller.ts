import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { OperationAttemptService } from "../../../../domain/application/services/operation-attempt-service";

const getOperationAttemptSchema = z.object({
  requestId: z.string().min(1, { message: "requestId é obrigatório." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
});

export class GetOperationAttemptController implements Controller {
  constructor(private operationAttemptService: OperationAttemptService) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = getOperationAttemptSchema.parse(request);

      const attempt = await this.operationAttemptService.getOwnAttempt(
        parsed.userId,
        parsed.requestId,
      );

      if (!attempt) {
        return notFound({ error: "Tentativa de operação não encontrada." });
      }

      return ok({
        ...attempt,
        attempt,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
