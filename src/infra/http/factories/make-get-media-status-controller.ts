import type { Controller } from "../../../core/infra/controller";
import { GetMediaStatusUseCase } from "../../../domain/application/use-cases/media/get-media-status/get-media-status";
import { DrizzleMediaRepository } from "../../drizzle/repositories/drizzle-media-repository";
import { GetMediaStatusController } from "../controllers/media/get-media-status-controller";

export function makeGetMediaStatusController(): Controller {
  const mediaRepository = new DrizzleMediaRepository();
  const useCase = new GetMediaStatusUseCase(mediaRepository);
  return new GetMediaStatusController(useCase);
}
