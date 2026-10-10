import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { FetchBarbershopInvitationsUseCase } from "../../../../domain/application/use-cases/invitations/fetch-barbershop-invitations/fetch-barbershop-invitations";

const fetchBarbershopInvitationsSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class FetchBarbershopInvitationsController implements Controller {
  constructor(
    private fetchBarbershopInvitationsUseCase: FetchBarbershopInvitationsUseCase,
  ) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const parsed = fetchBarbershopInvitationsSchema.parse(request);

      const result = await this.fetchBarbershopInvitationsUseCase.execute({
        barbershopId: parsed.shopId,
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
