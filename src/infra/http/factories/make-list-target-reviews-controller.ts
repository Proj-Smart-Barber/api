import type { Controller } from "../../../core/infra/controller";
import { ListTargetReviewsUseCase } from "../../../domain/application/use-cases/reviews/list-target-reviews/list-target-reviews";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleServicesRepository } from "../../drizzle/repositories/drizzle-services-repository";
import { ListTargetReviewsController } from "../controllers/reviews/list-target-reviews-controller";

export function makeListTargetReviewsController(
  targetType?: "BARBER" | "SERVICE",
): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const servicesRepository = new DrizzleServicesRepository();

  const useCase = new ListTargetReviewsUseCase(
    reviewsRepository,
    usersRepository,
    barbershopsRepository,
    servicesRepository,
  );

  return new ListTargetReviewsController(useCase, targetType);
}
