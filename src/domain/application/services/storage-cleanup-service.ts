import type { MediaQuota } from "./media-quota";
import type { MediaRepository } from "../repositories/media-repository";
import type { StorageService } from "./storage-service";

export interface CleanupResult {
  cleanedCount: number;
  errors: string[];
}

export class StorageCleanupService {
  constructor(
    private mediaRepository: MediaRepository,
    private storageService: StorageService,
    private quota?: MediaQuota,
    private abortMultipart?: (id:string)=>Promise<void>,
  ) {}

  async execute(maxAgeMinutes = 15, limit = 50): Promise<CleanupResult> {
    const olderThan = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const orphans = await this.mediaRepository.findOrphans(olderThan, limit);

    let cleanedCount = 0;
    const errors: string[] = [];

    for (const item of orphans) {
      try {
        const isStaging =
          typeof item.objectKey === "string" &&
          item.objectKey.startsWith("staging/");
        const marked = await this.mediaRepository.markExpiredConditional(
          item.id.toString(),
          {
            allowedStatuses: [
              "PENDING",
              "PROCESSING",
              "REJECTED",
              "CANCELLED",
              "EXPIRED",
              "READY",
            ],
            currentGeneration: item.generation,
          },
        );

        if (!marked) {
          // Ignora se concorrentemente a mídia foi assumida/finalizada
          continue;
        }

        await this.abortMultipart?.(item.id.toString());
        if (isStaging) {
          await this.storageService.deleteStagingObject(item.objectKey);
        }
        if (!isStaging) {
          const keys = new Set([
            item.objectKey,
            ...Object.values(item.variants ?? {}).map(
              (variant) => variant.objectKey,
            ),
          ]);
          for (const key of keys) await this.storageService.deleteObject(key);
        }
        await this.mediaRepository.markStorageDeleted?.(item.id.toString());
        await this.quota?.release(item.id.toString());
        cleanedCount++;
      } catch (err: any) {
        errors.push(
          `Falha ao limpar mídia ${item.id.toString()}: ${err?.message || String(err)}`,
        );
      }
    }

    return { cleanedCount, errors };
  }
}
