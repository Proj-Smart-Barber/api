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
      const isHealthy = this.discoveryRepository.isLocationServiceHealthy
        ? await this.discoveryRepository.isLocationServiceHealthy()
        : false;

      if (input.mode === "NEARBY") {
        if (!isHealthy) {
          return left(new LocationServiceUnavailableError());
        }
      }

      const result = await this.discoveryRepository.search(input);

      if (input.mode === "ALL" && !isHealthy) {
        return right({
          ...result,
          items: result.items.map((item) => ({
            ...item,
            coordinates: null,
          })),
        });
      }

      return right(result);
    } catch (error) {
      if (error instanceof LocationServiceUnavailableError) {
        return left(error);
      }
      throw error;
    }
  }
}
