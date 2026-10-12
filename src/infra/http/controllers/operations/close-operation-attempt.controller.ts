import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { OperationAttemptService } from "../../../../domain/application/services/operation-attempt-service";

const closeOperationAttemptSchema = z.object({
  requestId: z.string().min(1, { message: "requestId é obrigatório." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
});

export class CloseOperationAttemptController implements Controller {
  constructor(private operationAttemptService: OperationAttemptService) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = closeOperationAttemptSchema.parse(request);

      const result = await this.operationAttemptService.closeOwnAttempt(
        parsed.userId,
        parsed.requestId,
      );

      return ok(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
