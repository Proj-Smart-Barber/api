import { DrizzleBarbershopLocationsRepository } from "../../drizzle/repositories/drizzle-barbershop-locations-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleGeocodingCandidatesRepository } from "../../drizzle/repositories/drizzle-geocoding-candidates-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { UpdateBarbershopLocationUseCase } from "../../../domain/application/use-cases/location/update-barbershop-location/update-barbershop-location";
import { UpdateBarbershopLocationController } from "../controllers/location/update-barbershop-location.controller";

export function makeUpdateBarbershopLocationController() {
  const locationsRepository = new DrizzleBarbershopLocationsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const candidatesRepository = new DrizzleGeocodingCandidatesRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();

  const updateBarbershopLocationUseCase = new UpdateBarbershopLocationUseCase(
    locationsRepository,
    barbershopsRepository,
    candidatesRepository,
    membershipsRepository,
    unitOfWork,
  );

  return new UpdateBarbershopLocationController(
    updateBarbershopLocationUseCase,
  );
}
