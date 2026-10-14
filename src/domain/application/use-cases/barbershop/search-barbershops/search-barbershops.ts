import { type Either, left, right } from "../../../../../core/logic/either";
import type { DiscoveryRepository } from "../../../repositories/discovery-repository";
import type {
  DiscoveryInput,
  DiscoveryPage,
} from "../../../services/discovery-contract";
import { LocationServiceUnavailableError } from "../../_errors/location-service-unavailable-error";

export type SearchBarbershopsResponse = Either<
  LocationServiceUnavailableError,
  DiscoveryPage
>;

export class SearchBarbershopsUseCase {
  constructor(private discoveryRepository: DiscoveryRepository) {}

  async execute(input: DiscoveryInput): Promise<SearchBarbershopsResponse> {
    try {
      if (input.mode === "NEARBY") {
        if (this.discoveryRepository.isLocationServiceHealthy) {
          const isHealthy =
            await this.discoveryRepository.isLocationServiceHealthy();
          if (!isHealthy) {
            return left(new LocationServiceUnavailableError());
          }
        }
      }

      const result = await this.discoveryRepository.search(input);
      return right(result);
    } catch (error) {
      if (error instanceof LocationServiceUnavailableError) {
        return left(error);
      }
      throw error;
    }
  }
}
