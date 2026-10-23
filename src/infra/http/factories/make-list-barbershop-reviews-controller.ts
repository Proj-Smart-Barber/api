import type { Controller } from "../../../core/infra/controller";
import { ListBarbershopReviewsUseCase } from "../../../domain/application/use-cases/reviews/list-barbershop-reviews/list-barbershop-reviews";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { ListBarbershopReviewsController } from "../controllers/reviews/list-barbershop-reviews-controller";

export function makeListBarbershopReviewsController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const usersRepository = new DrizzleUsersRepository();

  const useCase = new ListBarbershopReviewsUseCase(
    reviewsRepository,
    usersRepository,
  );

  return new ListBarbershopReviewsController(useCase);
}
