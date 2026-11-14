import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { GetBookingReviewUseCase } from "../../../../domain/application/use-cases/reviews/get-booking-review/get-booking-review";
import { ReviewMapper } from "../../../../domain/enterprise/mappers/review-mapper";

const getBookingReviewSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid().optional(),
});

type GetBookingReviewRequest = z.infer<typeof getBookingReviewSchema>;

export class GetBookingReviewController implements Controller {
  constructor(private getBookingReviewUseCase: GetBookingReviewUseCase) {}

  async handle(request: GetBookingReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = getBookingReviewSchema.parse(request);

      const result = await this.getBookingReviewUseCase.execute({
        bookingId: parsed.bookingId,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError({ message: error.message });
      }

      const { review, platformFeedback } = result.value;

      return ok({
        review: review
          ? ReviewMapper.toHTTP(review, review.items, platformFeedback ?? null)
          : null,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
