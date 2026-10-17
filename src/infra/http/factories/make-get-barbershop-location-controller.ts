import { DrizzleBarbershopLocationsRepository } from "../../drizzle/repositories/drizzle-barbershop-locations-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { GetBarbershopLocationUseCase } from "../../../domain/application/use-cases/location/get-barbershop-location/get-barbershop-location";
import { GetBarbershopLocationController } from "../controllers/location/get-barbershop-location.controller";

export function makeGetBarbershopLocationController() {
  const locationsRepository = new DrizzleBarbershopLocationsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();

  const getBarbershopLocationUseCase = new GetBarbershopLocationUseCase(
    locationsRepository,
    barbershopsRepository,
    membershipsRepository,
  );

  return new GetBarbershopLocationController(getBarbershopLocationUseCase);
}
