import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { GetBookingReviewUseCase } from "../../../../domain/application/use-cases/reviews/get-booking-review/get-booking-review";

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

      const review = result.value.review;

      return ok({
        review: review
          ? {
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
            }
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
