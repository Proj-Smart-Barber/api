import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { UpdateReviewUseCase } from "../../../../domain/application/use-cases/reviews/update-review/update-review";
import { ReviewMapper } from "../../../../domain/enterprise/mappers/review-mapper";

const serviceRatingSchema = z.object({
  bookingServiceItemId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5),
});

const platformFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
});

const updateReviewSchema = z
  .object({
    userId: z.string().uuid(),
    bookingId: z.string().uuid().optional(),
    reviewId: z.string().uuid().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    barbershopRating: z.coerce.number().int().min(1).max(5).optional(),
    barberId: z.string().uuid().nullable().optional(),
    barberRating: z.coerce.number().int().min(1).max(5).optional(),
    serviceRatings: z.array(serviceRatingSchema).max(30).optional(),
    comment: z.string().max(1000).optional(),
    platformFeedback: platformFeedbackSchema.nullable().optional(),
    expectedVersion: z.coerce.number().int(),
  })
  .superRefine((data, ctx) => {
    const shopRating = data.rating ?? data.barbershopRating;
    if (shopRating === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A nota da barbearia é obrigatória e deve ser entre 1 e 5.",
      });
    }
  });

type UpdateReviewRequest = z.infer<typeof updateReviewSchema>;

export class UpdateReviewController implements Controller {
  constructor(private updateReviewUseCase: UpdateReviewUseCase) {}

  async handle(request: UpdateReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = updateReviewSchema.parse(request);
      const resolvedRating = parsed.rating ?? parsed.barbershopRating!;

      const result = await this.updateReviewUseCase.execute({
        userId: parsed.userId,
        bookingId: parsed.bookingId,
        reviewId: parsed.reviewId,
        rating: resolvedRating,
        barberId: parsed.barberId,
        barberRating: parsed.barberRating,
        serviceRatings: parsed.serviceRatings,
        comment: parsed.comment,
        platformFeedback: parsed.platformFeedback,
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

      const { review, platformFeedback } = result.value;

      return ok({
        review: ReviewMapper.toHTTP(
          review,
          review.items,
          platformFeedback ?? null,
        ),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
