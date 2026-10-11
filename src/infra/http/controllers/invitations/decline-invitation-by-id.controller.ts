import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { RespondToInvitationUseCase } from "../../../../domain/application/use-cases/invitations/respond-to-invitation/respond-to-invitation";

const declineByIdSchema = z.object({
  invitationId: z.string().uuid({ message: "ID do convite inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class DeclineInvitationByIdController implements Controller {
  constructor(private respondToInvitationUseCase: RespondToInvitationUseCase) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      if (
        request.body &&
        ("userId" in request.body || "invitationId" in request.body)
      ) {
        return clientError({
          error: "Parâmetros homônimos no body são proibidos.",
        });
      }
      if (
        request.query &&
        ("userId" in request.query || "invitationId" in request.query)
      ) {
        return clientError({
          error: "Parâmetros homônimos na query são proibidos.",
        });
      }

      const parsed = declineByIdSchema.parse(request);

      const result = await this.respondToInvitationUseCase.execute({
        userId: parsed.userId,
        action: "DECLINE",
        reference: { kind: "id", invitationId: parsed.invitationId },
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
