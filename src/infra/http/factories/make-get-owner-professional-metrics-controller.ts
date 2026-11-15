import type { Controller } from "../../../core/infra/controller";
import { GetOwnerProfessionalMetricsUseCase } from "../../../domain/application/use-cases/reviews/owner-insights/get-owner-professional-metrics";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleReviewInsightsRepository } from "../../drizzle/repositories/drizzle-review-insights-repository";
import { GetOwnerProfessionalMetricsController } from "../controllers/reviews/review-insights/get-owner-professional-metrics.controller";

export function makeGetOwnerProfessionalMetricsController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const reviewInsightsRepository = new DrizzleReviewInsightsRepository();
  const useCase = new GetOwnerProfessionalMetricsUseCase(
    barbershopsRepository,
    membershipsRepository,
    reviewInsightsRepository,
  );

  return new GetOwnerProfessionalMetricsController(useCase);
}
