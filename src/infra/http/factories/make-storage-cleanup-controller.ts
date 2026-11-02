import {abortMediaMultipart} from "../../storage/multipart-cleanup";
import { DrizzleMediaQuota } from "../../drizzle/repositories/drizzle-media-quota";
import { DrizzleMediaRepository } from "../../drizzle/repositories/drizzle-media-repository";
import { getStorageService } from "../../storage/storage-service-factory";
import { StorageCleanupService } from "../../../domain/application/services/storage-cleanup-service";
import { StorageCleanupController } from "../controllers/internal/storage-cleanup-controller";

export function makeStorageCleanupController() {
  const mediaRepository = new DrizzleMediaRepository();
  const storageService = getStorageService();
  const storageCleanupService = new StorageCleanupService(
    mediaRepository,
    storageService,
    new DrizzleMediaQuota(),
    abortMediaMultipart,
  );

  return new StorageCleanupController(storageCleanupService);
}
