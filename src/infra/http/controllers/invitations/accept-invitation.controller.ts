import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { AcceptInvitationUseCase } from "../../../../domain/application/use-cases/invitations/accept-invitation/accept-invitation";

const acceptInvitationSchema = z.object({
  token: z.string().min(1, { message: "Token inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class AcceptInvitationController implements Controller {
  constructor(private acceptInvitationUseCase: AcceptInvitationUseCase) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const parsed = acceptInvitationSchema.parse(request);

      const result = await this.acceptInvitationUseCase.execute({
        token: parsed.token,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      return ok({
        accepted: true,
        invitationId: result.value.invitationId,
        barbershopId: result.value.barbershopId,
        barbermanId: result.value.barbermanId,
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
