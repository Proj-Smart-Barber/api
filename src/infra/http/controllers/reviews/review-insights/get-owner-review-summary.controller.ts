import { z } from "zod";
import type { Controller } from "../../../../../core/infra/controller";
import {
  clientError,
  fail,
  forbidden,
  notFound,
  type HttpResponse,
} from "../../../../../core/infra/http-response";
import { NotAllowedError } from "../../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ValidationError } from "../../../../../domain/application/use-cases/_errors/validation-error";
import type { GetOwnerReviewSummaryUseCase } from "../../../../../domain/application/use-cases/reviews/owner-insights/get-owner-review-summary";

const querySchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  source: z
    .enum(["CUSTOMER", "DEMO", "UNKNOWN", "ALL"])
    .optional()
    .default("CUSTOMER"),
  granularity: z.enum(["WEEK", "MONTH"]).optional().default("WEEK"),
});

export class GetOwnerReviewSummaryController implements Controller {
  constructor(private useCase: GetOwnerReviewSummaryUseCase) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = querySchema.parse(request);

      const result = await this.useCase.execute({
        shopId: parsed.shopId,
        actorId: parsed.userId,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        source: parsed.source,
        granularity: parsed.granularity,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof ValidationError) {
          return clientError({ error: "VALIDATION_ERROR", message: error.message });
        }
        if (error instanceof NotAllowedError) {
          return forbidden({ error: error.message, message: error.message });
        }
        return notFound({ error: error.message, message: error.message });
      }

      return {
        statusCode: 200,
        body: result.value,
        headers: {
          "Cache-Control": "no-store, private",
          Pragma: "no-cache",
        },
      };
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return clientError({
          error: "VALIDATION_ERROR",
          message: err.issues[0]?.message || "Dados inválidos.",
          details: err.issues,
        });
      }
      return fail(err);
    }
  }
}
