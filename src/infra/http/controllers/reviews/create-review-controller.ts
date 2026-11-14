import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { CreateReviewUseCase } from "../../../../domain/application/use-cases/reviews/create-review/create-review";
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

const createReviewSchema = z
  .object({
    userId: z.string().uuid(),
    bookingId: z.string().uuid(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    barbershopRating: z.coerce.number().int().min(1).max(5).optional(),
    barberId: z.string().uuid().nullable().optional(),
    barberRating: z.coerce.number().int().min(1).max(5).optional(),
    serviceRatings: z.array(serviceRatingSchema).max(30).optional(),
    comment: z.string().max(1000).optional(),
    platformFeedback: platformFeedbackSchema.nullable().optional(),
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

type CreateReviewRequest = z.infer<typeof createReviewSchema>;

export class CreateReviewController implements Controller {
  constructor(private createReviewUseCase: CreateReviewUseCase) {}

  async handle(request: CreateReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = createReviewSchema.parse(request);
      const resolvedRating = parsed.rating ?? parsed.barbershopRating!;

      const result = await this.createReviewUseCase.execute({
        userId: parsed.userId,
        bookingId: parsed.bookingId,
        rating: resolvedRating,
        barberId: parsed.barberId,
        barberRating: parsed.barberRating,
        serviceRatings: parsed.serviceRatings,
        comment: parsed.comment,
        platformFeedback: parsed.platformFeedback,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (
          error.message.includes("Já existe uma avaliação") ||
          error.message.includes("unique") ||
          error.message.includes("duplicate")
        ) {
          return {
            statusCode: 409,
            body: { message: error.message },
          };
        }
        return clientError({ message: error.message });
      }

      const { review, platformFeedback } = result.value;

      return created({
        review: ReviewMapper.toHTTP(
          review,
          review.items,
          platformFeedback ?? null,
        ),
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      if (
        err?.code === "23505" ||
        err?.message?.includes("Já existe uma avaliação") ||
        err?.message?.includes("unique") ||
        err?.message?.includes("duplicate")
      ) {
        return {
          statusCode: 409,
          body: { message: "Já existe uma avaliação para este agendamento." },
        };
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
