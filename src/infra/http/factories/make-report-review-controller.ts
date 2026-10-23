import type { Controller } from "../../../core/infra/controller";
import { ReportReviewUseCase } from "../../../domain/application/use-cases/reviews/report-review/report-review";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { ReportReviewController } from "../controllers/reviews/report-review-controller";

export function makeReportReviewController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const useCase = new ReportReviewUseCase(reviewsRepository);

  return new ReportReviewController(useCase);
}
