import { DrizzleGeocodingCandidatesRepository } from "../../drizzle/repositories/drizzle-geocoding-candidates-repository";
import { RefreshLocationsMaintenanceUseCase } from "../../../domain/application/use-cases/location/refresh-locations-maintenance/refresh-locations-maintenance";
import { RefreshLocationsMaintenanceController } from "../controllers/location/refresh-locations-maintenance.controller";

export function makeRefreshLocationsMaintenanceController() {
  const candidatesRepository = new DrizzleGeocodingCandidatesRepository();
  const refreshLocationsMaintenanceUseCase =
    new RefreshLocationsMaintenanceUseCase(candidatesRepository);

  return new RefreshLocationsMaintenanceController(
    refreshLocationsMaintenanceUseCase,
  );
}
