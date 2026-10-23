import {
  type StorageService,
  StorageUnavailableError,
  type GenerateUploadUrlParams,
  type GenerateUploadUrlResult,
  type InspectObjectResult,
  type SaveVariantParams,
} from "../../domain/application/services/storage-service";
import { R2StorageService } from "./r2-storage-service";
import { env } from "../env";

export { StorageUnavailableError };

export class UnconfiguredStorageService implements StorageService {
  isConfigured(): boolean {
    return false;
  }

  async generateUploadUrl(_params: GenerateUploadUrlParams): Promise<GenerateUploadUrlResult> {
    throw new StorageUnavailableError(
      "Serviço de armazenamento de mídia não configurado neste ambiente."
    );
  }

  async inspectObject(_objectKey: string): Promise<InspectObjectResult> {
    throw new StorageUnavailableError(
      "Serviço de armazenamento de mídia não configurado neste ambiente."
    );
  }

  async inspectStagingObject(_objectKey: string, _maxBytes?: number): Promise<InspectObjectResult> {
    throw new StorageUnavailableError(
      "Serviço de armazenamento de mídia não configurado neste ambiente."
    );
  }

  async saveVariant(_params: SaveVariantParams): Promise<{ publicUrl: string; objectKey: string }> {
    throw new StorageUnavailableError(
      "Serviço de armazenamento de mídia não configurado neste ambiente."
    );
  }

  async deleteObject(_objectKey: string): Promise<void> {
    throw new StorageUnavailableError(
      "Serviço de armazenamento de mídia não configurado neste ambiente."
    );
  }

  async deleteStagingObject(_objectKey: string): Promise<void> {
    throw new StorageUnavailableError(
      "Serviço de armazenamento de mídia não configurado neste ambiente."
    );
  }

  getPublicUrl(_objectKey: string): string {
    throw new StorageUnavailableError(
      "Serviço de armazenamento de mídia não configurado neste ambiente."
    );
  }
}

let defaultStorageService: StorageService | null = null;

export function isStorageConfigured(): boolean {
  const stagingBucket = env.STORAGE_STAGING_BUCKET || env.STORAGE_BUCKET;
  const publicBucket = env.STORAGE_PUBLIC_BUCKET || env.STORAGE_BUCKET;

  if (
    !env.STORAGE_ENDPOINT ||
    !env.STORAGE_ACCESS_KEY_ID ||
    !env.STORAGE_SECRET_ACCESS_KEY ||
    !stagingBucket ||
    !publicBucket ||
    !env.STORAGE_PUBLIC_URL
  ) {
    return false;
  }

  // Isolamento obrigatório: buckets de staging (privado) e público devem ser distintos
  if (stagingBucket === publicBucket) {
    return false;
  }

  return true;
}

export function getStorageService(): StorageService {
  if (defaultStorageService) {
    return defaultStorageService;
  }

  if (!isStorageConfigured()) {
    defaultStorageService = new UnconfiguredStorageService();
    return defaultStorageService;
  }

  const endpoint = env.STORAGE_ENDPOINT!;
  const stagingBucket = env.STORAGE_STAGING_BUCKET || env.STORAGE_BUCKET!;
  const publicBucket = env.STORAGE_PUBLIC_BUCKET || env.STORAGE_BUCKET!;
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID!;
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY!;
  const publicUrl = env.STORAGE_PUBLIC_URL!;

  defaultStorageService = new R2StorageService({
    endpoint,
    stagingBucket,
    publicBucket,
    accessKeyId,
    secretAccessKey,
    publicUrl,
    region: env.STORAGE_REGION || "auto",
  });

  return defaultStorageService;
}

export function setStorageService(service: StorageService): void {
  defaultStorageService = service;
}
