import { DrizzleExploreSnapshotRepository } from "../../drizzle/repositories/drizzle-explore-snapshot-repository";
import { DrizzleDiscoveryRepository } from "../../drizzle/repositories/drizzle-discovery-repository";
import { GetExploreFeedUseCase } from "../../../domain/application/use-cases/barbershop/get-explore-feed/get-explore-feed";
import { ExploreFeedController } from "../controllers/barbershop/explore-feed.controller";

export function makeExploreFeedController(): ExploreFeedController {
  const repository = new DrizzleDiscoveryRepository();
  const useCase = new GetExploreFeedUseCase(
    repository,
    new DrizzleExploreSnapshotRepository(),
  );
  return new ExploreFeedController(useCase);
}
