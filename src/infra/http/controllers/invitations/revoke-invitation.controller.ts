import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { RevokeInvitationUseCase } from "../../../../domain/application/use-cases/invitations/revoke-invitation/revoke-invitation";

const revokeInvitationSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  invitationId: z.string().uuid({ message: "ID do convite inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class RevokeInvitationController implements Controller {
  constructor(private revokeInvitationUseCase: RevokeInvitationUseCase) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const parsed = revokeInvitationSchema.parse(request);

      const result = await this.revokeInvitationUseCase.execute({
        barbershopId: parsed.shopId,
        invitationId: parsed.invitationId,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      return ok({
        revoked: true,
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
