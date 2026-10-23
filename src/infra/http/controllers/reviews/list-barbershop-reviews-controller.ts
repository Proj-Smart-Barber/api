import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ListBarbershopReviewsUseCase } from "../../../../domain/application/use-cases/reviews/list-barbershop-reviews/list-barbershop-reviews";

const listBarbershopReviewsSchema = z.object({
  shopId: z.string().uuid(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
});

type ListBarbershopReviewsRequest = z.infer<typeof listBarbershopReviewsSchema>;

export class ListBarbershopReviewsController implements Controller {
  constructor(
    private listBarbershopReviewsUseCase: ListBarbershopReviewsUseCase,
  ) {}

  async handle(request: ListBarbershopReviewsRequest): Promise<HttpResponse> {
    try {
      const parsed = listBarbershopReviewsSchema.parse(request);

      const result = await this.listBarbershopReviewsUseCase.execute({
        barbershopId: parsed.shopId,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError({ message: error.message });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
