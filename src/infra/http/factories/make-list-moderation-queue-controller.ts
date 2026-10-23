import type { Controller } from "../../../core/infra/controller";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { ListModerationQueueController } from "../controllers/reviews/list-moderation-queue-controller";

export function makeListModerationQueueController(): Controller {
  const reviewsRepository = new DrizzleReviewsRepository();
  const usersRepository = new DrizzleUsersRepository();

  return new ListModerationQueueController(reviewsRepository, usersRepository);
}
