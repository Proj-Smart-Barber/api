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
import { ResourceNotFoundError } from "../../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { GetOwnerFeedbacksUseCase } from "../../../../../domain/application/use-cases/reviews/owner-insights/get-owner-feedbacks";

const optionalBooleanSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === "boolean") return val;
    return val === "true" || val === "1";
  });

const querySchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  source: z.enum(["CUSTOMER", "DEMO", "ALL"]).optional().default("CUSTOMER"),
  targetType: z
    .enum(["ALL", "BARBERSHOP", "BARBER", "SERVICE"])
    .optional()
    .default("ALL"),
  targetId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  hasComment: optionalBooleanSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class GetOwnerFeedbacksController implements Controller {
  constructor(private useCase: GetOwnerFeedbacksUseCase) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = querySchema.parse(request);

      const result = await this.useCase.execute({
        shopId: parsed.shopId,
        actorId: parsed.userId,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        source: parsed.source,
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        rating: parsed.rating,
        hasComment: parsed.hasComment,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
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
