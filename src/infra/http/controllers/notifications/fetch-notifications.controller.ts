import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { FetchUserNotificationsUseCase } from "../../../../domain/application/use-cases/notifications/fetch-user-notifications/fetch-user-notifications";

const fetchNotificationsSchema = z.object({
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class FetchNotificationsController implements Controller {
  constructor(
    private fetchUserNotificationsUseCase: FetchUserNotificationsUseCase,
  ) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const parsed = fetchNotificationsSchema.parse(request);

      const result = await this.fetchUserNotificationsUseCase.execute({
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      return ok({ notifications: result.value.notifications });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
