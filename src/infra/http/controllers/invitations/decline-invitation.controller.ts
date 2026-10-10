import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { DeclineInvitationUseCase } from "../../../../domain/application/use-cases/invitations/decline-invitation/decline-invitation";

const declineInvitationSchema = z.object({
  token: z.string().min(1, { message: "Token inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class DeclineInvitationController implements Controller {
  constructor(private declineInvitationUseCase: DeclineInvitationUseCase) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const parsed = declineInvitationSchema.parse(request);

      const result = await this.declineInvitationUseCase.execute({
        token: parsed.token,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      return ok({
        declined: true,
        invitationId: result.value.invitationId,
        status: result.value.status,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
