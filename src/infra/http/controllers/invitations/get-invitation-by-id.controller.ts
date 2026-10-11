import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { InvitationsRepository } from "../../../../domain/application/repositories/invitations-repository";

const getByIdSchema = z.object({
  invitationId: z.string().uuid({ message: "ID do convite inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class GetInvitationByIdController implements Controller {
  constructor(private invitationsRepository: InvitationsRepository) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const parsed = getByIdSchema.parse(request);

      const invitation = await this.invitationsRepository.findById(
        parsed.invitationId,
      );

      if (!invitation) {
        return notFound({ error: "Convite não encontrado." });
      }

      return ok({
        invitation: {
          id: invitation.id.toString(),
          barbershopId: invitation.barbershopId.toString(),
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt
            ? invitation.createdAt.toISOString()
            : null,
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
