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
import type { ListUnitTeamUseCase } from "../../../../domain/application/use-cases/barbershop/list-unit-team/list-unit-team";

const listUnitTeamSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  state: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
});

export class ListUnitTeamController implements Controller {
  constructor(private listUnitTeamUseCase: ListUnitTeamUseCase) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = listUnitTeamSchema.parse(request);

      const result = await this.listUnitTeamUseCase.execute({
        actorId: parsed.userId,
        shopId: parsed.shopId,
        state: parsed.state,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message });
        }
        if (error instanceof NotAllowedError) {
          return forbidden({ error: error.message });
        }
        return clientError({
          error: (error as any).message ?? "Erro desconhecido",
        });
      }

      return ok({
        ...result.value,
        members: result.value.items,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
