import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  forbidden,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { MarkNotificationAsReadUseCase } from "../../../../domain/application/use-cases/notifications/mark-notification-as-read/mark-notification-as-read";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";

const markReadSchema = z.object({
  notificationId: z.string().uuid({ message: "ID da notificação inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class MarkNotificationAsReadController implements Controller {
  constructor(
    private markNotificationAsReadUseCase: MarkNotificationAsReadUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const body = request._body || request.body;
      const query = request._query || request.query;

      if (body && ("userId" in body || "notificationId" in body)) {
        return clientError({
          error: "Parâmetros homônimos no body são proibidos.",
        });
      }
      if (query && ("userId" in query || "notificationId" in query)) {
        return clientError({
          error: "Parâmetros homônimos na query são proibidos.",
        });
      }

      const parsed = markReadSchema.parse(request);

      const result = await this.markNotificationAsReadUseCase.execute({
        notificationId: parsed.notificationId,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: "Notificação não encontrada." });
        }
        if (error instanceof NotAllowedError) {
          return forbidden({
            error: "Acesso não autorizado a esta notificação.",
          });
        }
        return clientError({ error: error.message });
      }

      return ok({
        notification: {
          id: result.value.notification.id,
          readAt: result.value.notification.readAt?.toISOString() ?? null,
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
