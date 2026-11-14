import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  notFound,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ListTargetReviewsUseCase } from "../../../../domain/application/use-cases/reviews/list-target-reviews/list-target-reviews";

const listTargetReviewsSchema = z
  .object({
    shopId: z.string().uuid().optional(),
    barberId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().optional().default(10),
  })
  .superRefine((data, ctx) => {
    if (!data.barberId && !data.serviceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o identificador do profissional ou do serviço.",
      });
    }
  });

type ListTargetReviewsRequest = z.infer<typeof listTargetReviewsSchema>;

export class ListTargetReviewsController implements Controller {
  constructor(
    private listTargetReviewsUseCase: ListTargetReviewsUseCase,
    private fixedTargetType?: "BARBER" | "SERVICE",
  ) {}

  async handle(request: ListTargetReviewsRequest): Promise<HttpResponse> {
    try {
      const parsed = listTargetReviewsSchema.parse(request);
      const targetType =
        this.fixedTargetType ?? (parsed.barberId ? "BARBER" : "SERVICE");
      const targetId =
        targetType === "BARBER" ? parsed.barberId! : parsed.serviceId!;

      const result = await this.listTargetReviewsUseCase.execute({
        targetType,
        targetId,
        barbershopId: parsed.shopId,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error.message.includes("não encontrad")) {
          return notFound({ message: error.message });
        }
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
