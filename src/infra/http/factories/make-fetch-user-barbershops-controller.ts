import type { Controller } from "../../../core/infra/controller";
import { FetchUserBarbershopsUseCase } from "../../../domain/application/use-cases/users/fetch-user-barbershops/fetch-user-barbershops";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { FetchUserBarbershopsController } from "../controllers/users/fetch-user-barbershops.controller";

export function makeFetchUserBarbershopsController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const fetchUserBarbershopsUseCase = new FetchUserBarbershopsUseCase(
    barbershopsRepository,
  );

  return new FetchUserBarbershopsController(fetchUserBarbershopsUseCase);
}
