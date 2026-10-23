import type { Controller } from "../../../core/infra/controller";
import { UpdateReviewUseCase } from "../../../domain/application/use-cases/reviews/update-review/update-review";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { UpdateReviewController } from "../controllers/reviews/update-review-controller";

export function makeUpdateReviewController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();

  const useCase = new UpdateReviewUseCase(
    reviewsRepository,
    barbershopsRepository,
  );

  return new UpdateReviewController(useCase);
}
