import type { Controller } from "../../../core/infra/controller";
import { GetBookingReviewUseCase } from "../../../domain/application/use-cases/reviews/get-booking-review/get-booking-review";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { GetBookingReviewController } from "../controllers/reviews/get-booking-review-controller";

export function makeGetBookingReviewController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const useCase = new GetBookingReviewUseCase(reviewsRepository);

  return new GetBookingReviewController(useCase);
}
