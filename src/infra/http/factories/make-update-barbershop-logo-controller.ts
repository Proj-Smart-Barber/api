import type { Controller } from "../../../core/infra/controller";
import { UpdateBarbershopLogoUseCase } from "../../../domain/application/use-cases/media/update-barbershop-logo/update-barbershop-logo";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleMediaRepository } from "../../drizzle/repositories/drizzle-media-repository";
import { UpdateBarbershopLogoController } from "../controllers/barbershop/update-barbershop-logo-controller";

export function makeUpdateBarbershopLogoController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const mediaRepository = new DrizzleMediaRepository();

  const useCase = new UpdateBarbershopLogoUseCase(
    barbershopsRepository,
    membershipsRepository,
    mediaRepository,
  );

  return new UpdateBarbershopLogoController(useCase);
}
