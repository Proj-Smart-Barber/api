import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { UpdateReviewUseCase } from "../../../../domain/application/use-cases/reviews/update-review/update-review";

const updateReviewSchema = z.object({
  userId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  expectedVersion: z.coerce.number().int(),
});

type UpdateReviewRequest = z.infer<typeof updateReviewSchema>;

export class UpdateReviewController implements Controller {
  constructor(private updateReviewUseCase: UpdateReviewUseCase) {}

  async handle(request: UpdateReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = updateReviewSchema.parse(request);

      const result = await this.updateReviewUseCase.execute({
        userId: parsed.userId,
        bookingId: parsed.bookingId,
        reviewId: parsed.reviewId,
        rating: parsed.rating,
        comment: parsed.comment,
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

      const review = result.value.review;

      return ok({
        review: {
          id: review.id.toString(),
          bookingId: review.bookingId.toString(),
          barbershopId: review.barbershopId.toString(),
          customerId: review.customerId.toString(),
          rating: review.rating,
          comment: review.comment,
          status: review.status,
          version: review.version,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
