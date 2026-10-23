import type { Controller } from "../../../core/infra/controller";
import { UpdateBarbershopGoogleUrlUseCase } from "../../../domain/application/use-cases/barbershop/update-barbershop-google-url/update-barbershop-google-url";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { UpdateBarbershopGoogleUrlController } from "../controllers/barbershop/update-barbershop-google-url-controller";

export function makeUpdateBarbershopGoogleUrlController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();

  const useCase = new UpdateBarbershopGoogleUrlUseCase(
    barbershopsRepository,
    membershipsRepository,
  );

  return new UpdateBarbershopGoogleUrlController(useCase);
}
