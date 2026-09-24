import type { Controller } from "@/core/infra/controller";
import { CreateBarbershopUseCase } from "@/domain/application/use-cases/barbershop/create-barbershop/create-barbershop";
import { DrizzleBarbershopsRepository } from "@/infra/drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleStaffsRepository } from "@/infra/drizzle/repositories/drizzle-staffs-repository";
import { CreateBarbershopController } from "../controllers/barbershop/create-barbershop.controller";

export function makeCreateBarbershopController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const staffsRepository = new DrizzleStaffsRepository();
  const createBarbershopUseCase = new CreateBarbershopUseCase(
    barbershopsRepository,
    staffsRepository,
  );

  return new CreateBarbershopController(createBarbershopUseCase);
}
