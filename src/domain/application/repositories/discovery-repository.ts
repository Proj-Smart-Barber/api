import type {
  DiscoveryInput,
  DiscoveryPage,
} from "../services/discovery-contract";

export interface DiscoveryRepository {
  search(input: DiscoveryInput): Promise<DiscoveryPage>;
  isLocationServiceHealthy?(): Promise<boolean>;
}
