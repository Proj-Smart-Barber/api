import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ModerateReviewUseCase } from "../../../../domain/application/use-cases/reviews/moderate-review/moderate-review";

const moderateReviewSchema = z.object({
  userId: z.string().uuid(),
  reviewId: z.string().uuid(),
  action: z.enum(["HIDE", "RESTORE"]),
  note: z.string().max(500).optional(),
  expectedVersion: z.coerce.number().int().positive(),
});

type ModerateReviewRequest = z.infer<typeof moderateReviewSchema>;

export class ModerateReviewController implements Controller {
  constructor(private moderateReviewUseCase: ModerateReviewUseCase) {}

  async handle(request: ModerateReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = moderateReviewSchema.parse(request);

      const result = await this.moderateReviewUseCase.execute({
        adminUserId: parsed.userId,
        reviewId: parsed.reviewId,
        action: parsed.action,
        note: parsed.note,
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
