import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { FetchUserInvitationsUseCase } from "../../../../domain/application/use-cases/invitations/fetch-user-invitations/fetch-user-invitations";

const fetchUserInvitationsSchema = z.object({
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class FetchUserInvitationsController implements Controller {
  constructor(
    private fetchUserInvitationsUseCase: FetchUserInvitationsUseCase,
  ) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const parsed = fetchUserInvitationsSchema.parse(request);

      const result = await this.fetchUserInvitationsUseCase.execute({
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      return ok({ invitations: result.value.invitations });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
