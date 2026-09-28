import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  ok,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { FetchStaffBarbershopsUseCase } from "../../../../domain/application/use-cases/staff/fetch-staff-barbershops/fetch-staff-barbershops";
import { z, ZodError } from "zod";

const fetchStaffBarbershopsSchema = z.object({
  userId: z.string().uuid({ message: "ID de usuário inválido." }),
});

type FetchStaffBarbershopsControllerRequest = z.infer<
  typeof fetchStaffBarbershopsSchema
>;

export class FetchStaffBarbershopsController implements Controller {
  constructor(
    private fetchStaffBarbershopsUseCase: FetchStaffBarbershopsUseCase,
  ) {}

  async handle(
    request: FetchStaffBarbershopsControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId } = fetchStaffBarbershopsSchema.parse(request);

      const result = await this.fetchStaffBarbershopsUseCase.execute({
        staffId: userId,
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
