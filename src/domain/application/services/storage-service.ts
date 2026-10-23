export class StorageUnavailableError extends Error {
  constructor(
    message = "Serviço de armazenamento não configurado ou temporariamente indisponível."
  ) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export interface GenerateUploadUrlParams {
  objectKey: string;
  mimeType: string;
  fileSize: number;
  expiresInSeconds?: number;
}

export interface GenerateUploadUrlResult {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

export interface InspectObjectResult {
  exists: boolean;
  size: number;
  contentType?: string;
  buffer?: Buffer;
  truncated?: boolean;
}

export interface SaveVariantParams {
  objectKey: string;
  buffer: Buffer;
  mimeType: string;
}

export interface StorageService {
  isConfigured(): boolean;
  generateUploadUrl(params: GenerateUploadUrlParams): Promise<GenerateUploadUrlResult>;
  inspectObject(objectKey: string): Promise<InspectObjectResult>;
  inspectStagingObject(objectKey: string, maxBytes?: number): Promise<InspectObjectResult>;
  saveVariant(params: SaveVariantParams): Promise<{ publicUrl: string; objectKey: string }>;
  deleteObject(objectKey: string): Promise<void>;
  deleteStagingObject(objectKey: string): Promise<void>;
  getPublicUrl(objectKey: string): string;
}
