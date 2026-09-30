import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  ok,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { FetchUserBarbershopsUseCase } from "../../../../domain/application/use-cases/users/fetch-user-barbershops/fetch-user-barbershops";
import { z, ZodError } from "zod";

const fetchUserBarbershopsSchema = z.object({
  userId: z.string().uuid({ message: "ID de usuário inválido." }),
});

type FetchUserBarbershopsControllerRequest = z.infer<
  typeof fetchUserBarbershopsSchema
>;

export class FetchUserBarbershopsController implements Controller {
  constructor(
    private fetchUserBarbershopsUseCase: FetchUserBarbershopsUseCase,
  ) {}

  async handle(
    request: FetchUserBarbershopsControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId } = fetchUserBarbershopsSchema.parse(request);

      const result = await this.fetchUserBarbershopsUseCase.execute({
        userId,
      });

      if (result.isLeft()) {
        return clientError({ error: result.value.message });
      }

      return ok(result.value);
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError({ error: z.prettifyError(error) });
      }

      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
