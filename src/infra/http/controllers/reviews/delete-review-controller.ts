import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { DeleteReviewUseCase } from "../../../../domain/application/use-cases/reviews/delete-review/delete-review";

const deleteReviewSchema = z.object({
  userId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  expectedVersion: z.coerce.number().int().positive(),
});

type DeleteReviewRequest = z.infer<typeof deleteReviewSchema>;

export class DeleteReviewController implements Controller {
  constructor(private deleteReviewUseCase: DeleteReviewUseCase) {}

  async handle(request: DeleteReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = deleteReviewSchema.parse(request);

      const result = await this.deleteReviewUseCase.execute({
        userId: parsed.userId,
        bookingId: parsed.bookingId,
        reviewId: parsed.reviewId,
        expectedVersion: parsed.expectedVersion,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error.message.includes("Conflito de versão")) {
          return {
            statusCode: 409,
            body: { message: error.message },
          };
        }
        return clientError({ message: error.message });
      }

      return ok({ message: "Avaliação removida com sucesso." });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
