import type { Controller } from "../../../core/infra/controller";
import { ConfirmMediaUploadUseCase } from "../../../domain/application/use-cases/media/confirm-upload/confirm-upload";
import { DrizzleMediaRepository } from "../../drizzle/repositories/drizzle-media-repository";
import { getStorageService } from "../../storage/storage-service-factory";
import { SharpImageProcessor } from "../../storage/sharp-image-processor";
import { ConfirmMediaUploadController } from "../controllers/media/confirm-media-upload-controller";

export function makeConfirmMediaUploadController(): Controller {
  const mediaRepository = new DrizzleMediaRepository();
  const storageService = getStorageService();
  const imageProcessor = new SharpImageProcessor();

  const useCase = new ConfirmMediaUploadUseCase(
    mediaRepository,
    storageService,
    imageProcessor,
  );

  return new ConfirmMediaUploadController(useCase);
}
