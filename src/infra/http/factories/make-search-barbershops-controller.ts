import { DrizzleDiscoveryRepository } from "../../drizzle/repositories/drizzle-discovery-repository";
import { SearchBarbershopsUseCase } from "../../../domain/application/use-cases/barbershop/search-barbershops/search-barbershops";
import {
  SearchBarbershopsController,
  SearchNearbyBarbershopsController,
} from "../controllers/barbershop/search-barbershops.controller";

export function makeSearchBarbershopsController() {
  const discoveryRepository = new DrizzleDiscoveryRepository();
  const searchBarbershopsUseCase = new SearchBarbershopsUseCase(
    discoveryRepository,
  );
  return new SearchBarbershopsController(searchBarbershopsUseCase);
}

export function makeSearchNearbyBarbershopsController() {
  const discoveryRepository = new DrizzleDiscoveryRepository();
  const searchBarbershopsUseCase = new SearchBarbershopsUseCase(
    discoveryRepository,
  );
  return new SearchNearbyBarbershopsController(searchBarbershopsUseCase);
}
