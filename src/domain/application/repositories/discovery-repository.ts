import type {ExploreFeedInput} from "../services/explore-feed.contract";
import type {
  DiscoveryInput,
  DiscoveryPage,
} from "../services/discovery-contract";

export interface DiscoveryRepository {
  rankExploreIds?(input:ExploreFeedInput):Promise<string[]>;
  search(input: DiscoveryInput): Promise<DiscoveryPage>;
  isLocationServiceHealthy?(): Promise<boolean>;
}
