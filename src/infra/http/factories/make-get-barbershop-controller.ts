import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { GetBarbershopUseCase } from "@/domain/application/use-cases/barbershop/get-barbershop/get-barbershop";
import { GetBarbershopController } from "../controllers/barbershop/get-barbershop.controller";

export function makeGetBarbershopController() {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const getBarbershopUseCase = new GetBarbershopUseCase(barbershopsRepository);
  return new GetBarbershopController(getBarbershopUseCase);
}
