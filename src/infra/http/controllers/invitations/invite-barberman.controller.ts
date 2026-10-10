import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { InviteBarbermanUseCase } from "../../../../domain/application/use-cases/invitations/invite-barberman/invite-barberman";

const inviteBarbermanSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
  email: z.email({ message: "E-mail inválido." }),
});

export class InviteBarbermanController implements Controller {
  constructor(private inviteBarbermanUseCase: InviteBarbermanUseCase) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const parsed = inviteBarbermanSchema.parse(request);

      const result = await this.inviteBarbermanUseCase.execute({
        barbershopId: parsed.shopId,
        userId: parsed.userId,
        email: parsed.email,
      });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      return created({
        invitationId: result.value.invitationId,
        invitedEmail: result.value.invitedEmail,
        expiresAt: result.value.expiresAt,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
