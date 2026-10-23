import type {
  MediaRepository,
  ClaimProcessingResult,
  FinalizeProcessingData,
} from "../../src/domain/application/repositories/media-repository";
import type { Media } from "../../src/domain/enterprise/entities/media";

export class InMemoryMediaRepository implements MediaRepository {
  public items: Media[] = [];

  async create(media: Media): Promise<void> {
    this.items.push(media);
  }

  async findById(id: string): Promise<Media | null> {
    const media = this.items.find((item) => item.id.toString() === id);
    return media ?? null;
  }

  async findByObjectKey(objectKey: string): Promise<Media | null> {
    const media = this.items.find((item) => item.objectKey === objectKey);
    return media ?? null;
  }

  async save(media: Media): Promise<void> {
    const index = this.items.findIndex((item) => item.id.toString() === media.id.toString());
    if (index >= 0) {
      this.items[index] = media;
    } else {
      this.items.push(media);
    }
  }

  async delete(id: string): Promise<void> {
    const index = this.items.findIndex((item) => item.id.toString() === id);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  async claimForProcessing(
    id: string,
    params: { leaseToken: string; leaseDurationMs: number }
  ): Promise<ClaimProcessingResult> {
    const item = this.items.find((m) => m.id.toString() === id);
    if (!item) {
      return { claimed: false };
    }

    const claimed = item.claimProcessing(params.leaseToken, params.leaseDurationMs);
    if (!claimed) {
      return { claimed: false };
    }

    return { claimed: true, media: item };
  }

  async releaseProcessing(
    id: string,
    leaseToken: string,
    options?: { resetToPending?: boolean; errorMessage?: string }
  ): Promise<boolean> {
    const item = this.items.find(
      (m) => m.id.toString() === id && m.leaseToken === leaseToken
    );
    if (!item) {
      return false;
    }

    item.releaseProcessing(options);
    return true;
  }

  async finalizeProcessing(
    id: string,
    leaseToken: string,
    data: FinalizeProcessingData
  ): Promise<boolean> {
    const item = this.items.find(
      (m) => m.id.toString() === id && m.leaseToken === leaseToken
    );
    if (!item) {
      return false;
    }

    item.finalizeReady(data);
    return true;
  }

  async rejectProcessing(
    id: string,
    leaseToken: string,
    reason: string
  ): Promise<boolean> {
    const item = this.items.find(
      (m) => m.id.toString() === id && m.leaseToken === leaseToken
    );
    if (!item) {
      return false;
    }

    item.markRejected();
    (item as any).props.errorMessage = reason;
    (item as any).props.leaseToken = null;
    (item as any).props.leaseExpiresAt = null;
    return true;
  }

  async markExpiredConditional(
    id: string,
    params: { allowedStatuses: string[]; currentGeneration: number }
  ): Promise<boolean> {
    const item = this.items.find((m) => m.id.toString() === id);
    if (!item) return false;
    if (item.generation !== params.currentGeneration) return false;
    if (!params.allowedStatuses.includes(item.status)) return false;

    item.markExpired();
    (item as any).props.leaseToken = null;
    (item as any).props.leaseExpiresAt = null;
    return true;
  }

  async findOrphans(olderThanDate: Date, limit: number): Promise<Media[]> {
    return this.items
      .filter(
        (item) =>
          (item.status === "PENDING" && item.createdAt < olderThanDate) ||
          (item.status === "PROCESSING" &&
            (item.isLeaseExpired() || item.updatedAt < olderThanDate)) ||
          (item.status === "REJECTED" && item.updatedAt < olderThanDate)
      )
      .slice(0, limit);
  }

  async countPendingByOwnerId(ownerId: string): Promise<number> {
    return this.items.filter(
      (item) => item.ownerId.toString() === ownerId && item.status === "PENDING"
    ).length;
  }
}
