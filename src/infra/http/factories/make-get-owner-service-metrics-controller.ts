import type { Controller } from "../../../core/infra/controller";
import { GetOwnerServiceMetricsUseCase } from "../../../domain/application/use-cases/reviews/owner-insights/get-owner-service-metrics";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleReviewInsightsRepository } from "../../drizzle/repositories/drizzle-review-insights-repository";
import { GetOwnerServiceMetricsController } from "../controllers/reviews/review-insights/get-owner-service-metrics.controller";

export function makeGetOwnerServiceMetricsController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const reviewInsightsRepository = new DrizzleReviewInsightsRepository();
  const useCase = new GetOwnerServiceMetricsUseCase(
    barbershopsRepository,
    membershipsRepository,
    reviewInsightsRepository,
  );

  return new GetOwnerServiceMetricsController(useCase);
}
