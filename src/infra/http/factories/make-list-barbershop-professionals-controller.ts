import { ListBarbershopProfessionalsUseCase } from "../../../domain/application/use-cases/barbershop/list-barbershop-professionals/list-barbershop-professionals";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleReviewsRepository } from "../../drizzle/repositories/drizzle-reviews-repository";
import { ListBarbershopProfessionalsController } from "../controllers/barbershop/list-barbershop-professionals.controller";

export function makeListBarbershopProfessionalsController(): ListBarbershopProfessionalsController {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const reviewsRepository = new DrizzleReviewsRepository();
  const useCase = new ListBarbershopProfessionalsUseCase(
    barbershopsRepository,
    membershipsRepository,
    usersRepository,
    reviewsRepository,
  );
  return new ListBarbershopProfessionalsController(useCase);
}
