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
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { FetchBarbershopInvitationsUseCase } from "../../../../domain/application/use-cases/invitations/fetch-barbershop-invitations/fetch-barbershop-invitations";

const fetchBarbershopInvitationsSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export class FetchBarbershopInvitationsController implements Controller {
  constructor(
    private fetchBarbershopInvitationsUseCase: FetchBarbershopInvitationsUseCase,
  ) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = fetchBarbershopInvitationsSchema.parse(request);

      const result = await this.fetchBarbershopInvitationsUseCase.execute({
        barbershopId: parsed.shopId,
        userId: parsed.userId,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message, message: error.message });
        }
        return forbidden({ error: error.message, message: error.message });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
