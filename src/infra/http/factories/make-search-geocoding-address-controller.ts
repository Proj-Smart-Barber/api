import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleGeocodingCandidatesRepository } from "../../drizzle/repositories/drizzle-geocoding-candidates-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { GoogleGeocodingProvider } from "../../services/google-geocoding-provider";
import { SearchGeocodingAddressUseCase } from "../../../domain/application/use-cases/location/search-geocoding-address/search-geocoding-address";
import { SearchGeocodingAddressController } from "../controllers/location/search-geocoding-address.controller";

export function makeSearchGeocodingAddressController() {
  const geocodingProvider = new GoogleGeocodingProvider();
  const candidatesRepository = new DrizzleGeocodingCandidatesRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();

  const searchGeocodingAddressUseCase = new SearchGeocodingAddressUseCase(
    geocodingProvider,
    candidatesRepository,
    barbershopsRepository,
    membershipsRepository,
  );

  return new SearchGeocodingAddressController(searchGeocodingAddressUseCase);
}
