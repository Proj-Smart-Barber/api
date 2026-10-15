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
import type { GetUnitTeamMemberUseCase } from "../../../../domain/application/use-cases/barbershop/get-unit-team-member/get-unit-team-member";

const getUnitTeamMemberSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  membershipId: z.string().uuid({ message: "ID do vínculo inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
});

export class GetUnitTeamMemberController implements Controller {
  constructor(private getUnitTeamMemberUseCase: GetUnitTeamMemberUseCase) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = getUnitTeamMemberSchema.parse(request);

      const result = await this.getUnitTeamMemberUseCase.execute({
        actorId: parsed.userId,
        shopId: parsed.shopId,
        membershipId: parsed.membershipId,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message, message: error.message });
        }
        if (error instanceof NotAllowedError) {
          return forbidden({ error: error.message, message: error.message });
        }
        return clientError({
          error: (error as any).message ?? "Erro desconhecido",
          message: (error as any).message ?? "Erro desconhecido",
        });
      }

      return ok({
        member: result.value,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
