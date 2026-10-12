import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ListBarbershopProfessionalsUseCase } from "../../../../domain/application/use-cases/barbershop/list-barbershop-professionals/list-barbershop-professionals";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";

const listProfessionalsSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
});

export class ListBarbershopProfessionalsController implements Controller {
  constructor(
    private listBarbershopProfessionalsUseCase: ListBarbershopProfessionalsUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const parsed = listProfessionalsSchema.parse(request);

      const result = await this.listBarbershopProfessionalsUseCase.execute({
        shopId: parsed.shopId,
      });

      if (result.isLeft()) {
        const error = result.value;
        return notFound({ error: error.message });
      }

      return ok({ professionals: result.value.professionals });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
