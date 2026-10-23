import type { Controller } from "../../../core/infra/controller";
import { CreateReviewUseCase } from "../../../domain/application/use-cases/reviews/create-review/create-review";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { CreateReviewController } from "../controllers/reviews/create-review-controller";

export function makeCreateReviewController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const bookingsRepository = new DrizzleBookingsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();

  const useCase = new CreateReviewUseCase(
    reviewsRepository,
    bookingsRepository,
    barbershopsRepository,
    membershipsRepository,
  );

  return new CreateReviewController(useCase);
}
