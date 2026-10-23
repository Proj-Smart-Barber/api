import type { Media, MediaVariantInfo } from "../../enterprise/entities/media";

export interface ClaimProcessingResult {
  claimed: boolean;
  media?: Media;
}

export interface FinalizeProcessingData {
  objectKey: string;
  publicUrl: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  variants: Record<string, MediaVariantInfo>;
  generation: number;
}

export interface MediaRepository {
  create(media: Media): Promise<void>;
  findById(id: string): Promise<Media | null>;
  findByObjectKey(objectKey: string): Promise<Media | null>;
  save(media: Media): Promise<void>;
  delete(id: string): Promise<void>;
  findOrphans(olderThanDate: Date, limit: number): Promise<Media[]>;
  countPendingByOwnerId(ownerId: string): Promise<number>;
  claimForProcessing(
    id: string,
    params: { leaseToken: string; leaseDurationMs: number }
  ): Promise<ClaimProcessingResult>;
  releaseProcessing(
    id: string,
    leaseToken: string,
    options?: { resetToPending?: boolean; errorMessage?: string }
  ): Promise<boolean>;
  finalizeProcessing(
    id: string,
    leaseToken: string,
    data: FinalizeProcessingData
  ): Promise<boolean>;
  rejectProcessing(
    id: string,
    leaseToken: string,
    reason: string
  ): Promise<boolean>;
  markExpiredConditional(
    id: string,
    params: { allowedStatuses: string[]; currentGeneration: number }
  ): Promise<boolean>;
}
