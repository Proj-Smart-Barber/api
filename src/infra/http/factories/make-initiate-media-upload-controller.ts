import type { Controller } from "../../../core/infra/controller";
import { InitiateMediaUploadUseCase } from "../../../domain/application/use-cases/media/initiate-upload/initiate-upload";
import { DrizzleMediaRepository } from "../../drizzle/repositories/drizzle-media-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { getStorageService } from "../../storage/storage-service-factory";
import { InitiateMediaUploadController } from "../controllers/media/initiate-media-upload-controller";

export function makeInitiateMediaUploadController(): Controller {
  const mediaRepository = new DrizzleMediaRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const storageService = getStorageService();

  const useCase = new InitiateMediaUploadUseCase(
    mediaRepository,
    storageService,
    membershipsRepository,
  );

  return new InitiateMediaUploadController(useCase);
}
