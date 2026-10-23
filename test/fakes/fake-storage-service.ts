import type {
  StorageService,
  GenerateUploadUrlParams,
  GenerateUploadUrlResult,
  InspectObjectResult,
  SaveVariantParams,
} from "../../src/domain/application/services/storage-service";

export class FakeStorageService implements StorageService {
  public stagingObjects = new Map<string, { buffer: Buffer; contentType: string; size: number }>();
  public publicObjects = new Map<string, { buffer: Buffer; contentType: string; size: number }>();
  public publicBaseUrl = "https://cdn.smartbarber.test";

  isConfigured(): boolean {
    return true;
  }

  async generateUploadUrl(params: GenerateUploadUrlParams): Promise<GenerateUploadUrlResult> {
    return {
      uploadUrl: `https://fake-storage.local/upload/${encodeURIComponent(params.objectKey)}`,
      publicUrl: this.getPublicUrl(params.objectKey),
      objectKey: params.objectKey,
    };
  }

  async inspectStagingObject(objectKey: string, maxBytes?: number): Promise<InspectObjectResult> {
    const item = this.stagingObjects.get(objectKey);
    if (!item) {
      return { exists: false, size: 0 };
    }

    if (maxBytes !== undefined && item.size > maxBytes) {
      return {
        exists: true,
        size: item.size,
        contentType: item.contentType,
        truncated: true,
      };
    }

    return {
      exists: true,
      size: item.size,
      contentType: item.contentType,
      buffer: item.buffer,
      truncated: false,
    };
  }

  async inspectObject(objectKey: string): Promise<InspectObjectResult> {
    const item = this.publicObjects.get(objectKey) || this.stagingObjects.get(objectKey);
    if (!item) {
      return { exists: false, size: 0 };
    }
    return {
      exists: true,
      size: item.size,
      contentType: item.contentType,
      buffer: item.buffer,
    };
  }

  async saveVariant(params: SaveVariantParams): Promise<{ publicUrl: string; objectKey: string }> {
    this.publicObjects.set(params.objectKey, {
      buffer: params.buffer,
      contentType: params.mimeType,
      size: params.buffer.length,
    });

    return {
      publicUrl: this.getPublicUrl(params.objectKey),
      objectKey: params.objectKey,
    };
  }

  async deleteStagingObject(objectKey: string): Promise<void> {
    this.stagingObjects.delete(objectKey);
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.publicObjects.delete(objectKey);
  }

  getPublicUrl(objectKey: string): string {
    const cleanKey = objectKey.replace(/^\/+/, "");
    return `${this.publicBaseUrl}/${cleanKey}`;
  }

  // Helpers for tests
  putFakeObject(objectKey: string, buffer: Buffer, contentType: string) {
    this.stagingObjects.set(objectKey, {
      buffer,
      contentType,
      size: buffer.length,
    });
    this.publicObjects.set(objectKey, {
      buffer,
      contentType,
      size: buffer.length,
    });
  }

  putStagingObject(objectKey: string, buffer: Buffer, contentType: string) {
    this.stagingObjects.set(objectKey, {
      buffer,
      contentType,
      size: buffer.length,
    });
  }
}
