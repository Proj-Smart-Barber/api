import type { Controller } from "../../../core/infra/controller";
import { GetOwnerReviewSummaryUseCase } from "../../../domain/application/use-cases/reviews/owner-insights/get-owner-review-summary";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleReviewInsightsRepository } from "../../drizzle/repositories/drizzle-review-insights-repository";
import { GetOwnerReviewSummaryController } from "../controllers/reviews/review-insights/get-owner-review-summary.controller";

export function makeGetOwnerReviewSummaryController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const reviewInsightsRepository = new DrizzleReviewInsightsRepository();
  const useCase = new GetOwnerReviewSummaryUseCase(
    barbershopsRepository,
    membershipsRepository,
    reviewInsightsRepository,
  );

  return new GetOwnerReviewSummaryController(useCase);
}
