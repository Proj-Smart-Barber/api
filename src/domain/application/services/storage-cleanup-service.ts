import type { MediaRepository } from "../repositories/media-repository";
import type { StorageService } from "./storage-service";

export interface CleanupResult {
  cleanedCount: number;
  errors: string[];
}

export class StorageCleanupService {
  constructor(
    private mediaRepository: MediaRepository,
    private storageService: StorageService
  ) {}

  async execute(maxAgeMinutes = 15, limit = 50): Promise<CleanupResult> {
    const olderThan = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const orphans = await this.mediaRepository.findOrphans(olderThan, limit);

    let cleanedCount = 0;
    const errors: string[] = [];

    for (const item of orphans) {
      try {
        const isStaging = typeof item.objectKey === "string" && item.objectKey.startsWith("staging/");
        const marked = await this.mediaRepository.markExpiredConditional(item.id.toString(), {
          allowedStatuses: ["PENDING", "PROCESSING", "REJECTED"],
          currentGeneration: item.generation,
        });

        if (!marked) {
          // Ignora se concorrentemente a mídia foi assumida/finalizada
          continue;
        }

        if (isStaging) {
          await this.storageService.deleteStagingObject(item.objectKey).catch(() => {});
        }
        cleanedCount++;
      } catch (err: any) {
        errors.push(`Falha ao limpar mídia ${item.id.toString()}: ${err?.message || String(err)}`);
      }
    }

    return { cleanedCount, errors };
  }
}
