import type { Controller } from "../../../core/infra/controller";
import { DeleteReviewUseCase } from "../../../domain/application/use-cases/reviews/delete-review/delete-review";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DeleteReviewController } from "../controllers/reviews/delete-review-controller";

export function makeDeleteReviewController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();

  const useCase = new DeleteReviewUseCase(
    reviewsRepository,
    barbershopsRepository,
  );

  return new DeleteReviewController(useCase);
}
