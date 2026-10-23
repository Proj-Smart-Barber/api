import type { MediaPurpose } from "../../enterprise/entities/media";

export type AllowedImageFormat = "jpeg" | "png" | "webp";

export interface ImageInspectionResult {
  valid: boolean;
  format?: AllowedImageFormat;
  mimeType?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface ImageVariant {
  name: "main" | "thumbnail";
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  format: AllowedImageFormat;
  sha256: string;
}

export interface ProcessImageResult {
  valid: boolean;
  format?: AllowedImageFormat;
  mimeType?: string;
  width?: number;
  height?: number;
  sha256?: string;
  variants: ImageVariant[];
  error?: string;
}

export interface ImageProcessorService {
  validateAndInspect(buffer: Buffer): Promise<ImageInspectionResult>;
  stripExif(buffer: Buffer, format: AllowedImageFormat): Promise<Buffer>;
  processImage(buffer: Buffer, purpose: MediaPurpose): Promise<ProcessImageResult>;
}
