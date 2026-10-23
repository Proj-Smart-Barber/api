import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ReportReviewUseCase } from "../../../../domain/application/use-cases/reviews/report-review/report-review";

const reportReviewSchema = z.object({
  userId: z.string().uuid(),
  reviewId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

type ReportReviewRequest = z.infer<typeof reportReviewSchema>;

export class ReportReviewController implements Controller {
  constructor(private reportReviewUseCase: ReportReviewUseCase) {}

  async handle(request: ReportReviewRequest): Promise<HttpResponse> {
    try {
      const parsed = reportReviewSchema.parse(request);

      const result = await this.reportReviewUseCase.execute({
        reporterUserId: parsed.userId,
        reviewId: parsed.reviewId,
        reason: parsed.reason,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError({ message: error.message });
      }

      return created(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
