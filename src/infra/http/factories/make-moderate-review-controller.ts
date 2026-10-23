import type { Controller } from "../../../core/infra/controller";
import { ModerateReviewUseCase } from "../../../domain/application/use-cases/reviews/moderate-review/moderate-review";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { ModerateReviewController } from "../controllers/reviews/moderate-review-controller";

export function makeModerateReviewController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();

  const useCase = new ModerateReviewUseCase(
    reviewsRepository,
    usersRepository,
    barbershopsRepository,
  );

  return new ModerateReviewController(useCase);
}
