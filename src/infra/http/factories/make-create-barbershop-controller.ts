import type { Controller } from "../../../core/infra/controller";
import { CreateBarbershopUseCase } from "../../../domain/application/use-cases/barbershop/create-barbershop/create-barbershop";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { CreateBarbershopController } from "../controllers/barbershop/create-barbershop.controller";

export function makeCreateBarbershopController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const createBarbershopUseCase = new CreateBarbershopUseCase(
    barbershopsRepository,
    usersRepository,
  );

  return new CreateBarbershopController(createBarbershopUseCase);
}
