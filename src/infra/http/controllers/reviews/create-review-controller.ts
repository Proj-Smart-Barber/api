import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { CreateReviewUseCase } from "../../../../domain/application/use-cases/reviews/create-review/create-review";

const createReviewSchema = z.object({
  userId: z.string().uuid(),
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

type CreateReviewRequest = z.infer<typeof createReviewSchema>;

export class CreateReviewController implements Controller {
  constructor(private createReviewUseCase: CreateReviewUseCase) {}

  async handle(request: CreateReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = createReviewSchema.parse(request);

      const result = await this.createReviewUseCase.execute({
        userId: parsed.userId,
        bookingId: parsed.bookingId,
        rating: parsed.rating,
        comment: parsed.comment,
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

      const review = result.value.review;

      return created({
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
