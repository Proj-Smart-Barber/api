import { UniqueEntityId } from "../../src/core/entities/unique-entity-id";
import type {
  BarbershopGalleryRepository,
  AddGalleryPhotoParams,
  AddGalleryPhotoResult,
  RemoveGalleryPhotoParams,
  RemoveGalleryPhotoResult,
  ReorderGalleryPhotosParams,
  SetCoverPhotoParams,
} from "../../src/domain/application/repositories/barbershop-gallery-repository";
import { BarbershopGalleryItem } from "../../src/domain/enterprise/entities/barbershop-gallery-item";

export class InMemoryBarbershopGalleryRepository implements BarbershopGalleryRepository {
  public items: BarbershopGalleryItem[] = [];
  private locks = new Map<string, Promise<void>>();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, lockPromise);
    return () => {
      this.locks.delete(key);
      release();
    };
  }

  async create(item: BarbershopGalleryItem): Promise<void> {
    const existing = await this.findByBarbershopIdAndMediaId(
      item.barbershopId.toString(),
      item.mediaId.toString()
    );
    if (existing) {
      const err: any = new Error("Unique constraint violation: item already exists in gallery");
      err.code = "23505";
      throw err;
    }
    if (item.isCover) {
      await this.clearCover(item.barbershopId.toString());
    }
    this.items.push(item);
  }

  async findById(id: string): Promise<BarbershopGalleryItem | null> {
    const item = this.items.find((i) => i.id.toString() === id);
    return item ?? null;
  }

  async findByBarbershopId(barbershopId: string): Promise<BarbershopGalleryItem[]> {
    return this.items
      .filter((i) => i.barbershopId.toString() === barbershopId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async findByBarbershopIdAndMediaId(
    barbershopId: string,
    mediaId: string
  ): Promise<BarbershopGalleryItem | null> {
    const item = this.items.find(
      (i) => i.barbershopId.toString() === barbershopId && i.mediaId.toString() === mediaId
    );
    return item ?? null;
  }

  async save(item: BarbershopGalleryItem): Promise<void> {
    const index = this.items.findIndex((i) => i.id.toString() === item.id.toString());
    if (index >= 0) {
      this.items[index] = item;
    } else {
      this.items.push(item);
    }
  }

  async saveMany(items: BarbershopGalleryItem[]): Promise<void> {
    for (const item of items) {
      await this.save(item);
    }
  }

  async delete(id: string): Promise<void> {
    const index = this.items.findIndex((i) => i.id.toString() === id);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  async countByBarbershopId(barbershopId: string): Promise<number> {
    return this.items.filter((i) => i.barbershopId.toString() === barbershopId).length;
  }

  async clearCover(barbershopId: string): Promise<void> {
    for (const item of this.items) {
      if (item.barbershopId.toString() === barbershopId && item.isCover) {
        item.setCover(false);
      }
    }
  }

  async addPhotoAtomic(params: AddGalleryPhotoParams): Promise<AddGalleryPhotoResult> {
    const release = await this.acquireLock(params.barbershopId);
    try {
      // 1. Idempotency check
      const existing = await this.findByBarbershopIdAndMediaId(
        params.barbershopId,
        params.mediaId
      );
      if (existing) {
        return { success: true, item: existing, isDuplicate: true };
      }

      // 2. Count limit check under lock
      const currentCount = await this.countByBarbershopId(params.barbershopId);
      if (currentCount >= params.maxPhotos) {
        return { success: false, reason: "LIMIT_EXCEEDED" };
      }

      // 3. Cover handling
      const shouldBeCover = params.isCover || currentCount === 0;
      if (shouldBeCover) {
        await this.clearCover(params.barbershopId);
      }

      const item = BarbershopGalleryItem.create({
        barbershopId: new UniqueEntityId(params.barbershopId),
        mediaId: new UniqueEntityId(params.mediaId),
        displayOrder: currentCount,
        caption: params.caption,
        isCover: shouldBeCover,
        publicUrl: params.publicUrl,
      });

      this.items.push(item);

      return { success: true, item, isDuplicate: false };
    } finally {
      release();
    }
  }

  async removePhotoAtomic(params: RemoveGalleryPhotoParams): Promise<RemoveGalleryPhotoResult> {
    const release = await this.acquireLock(params.barbershopId);
    try {
      const index = this.items.findIndex(
        (i) =>
          (i.id.toString() === params.galleryItemId ||
            i.mediaId.toString() === params.galleryItemId) &&
          i.barbershopId.toString() === params.barbershopId
      );

      if (index < 0) {
        return { success: false, reason: "NOT_FOUND" };
      }

      const [removed] = this.items.splice(index, 1);
      let newCoverPublicUrl: string | null = null;

      if (removed.isCover) {
        const remaining = await this.findByBarbershopId(params.barbershopId);
        if (remaining.length > 0) {
          remaining[0].setCover(true);
          newCoverPublicUrl = remaining[0].publicUrl ?? null;
        }
      }

      return { success: true, newCoverPublicUrl };
    } finally {
      release();
    }
  }

  async reorderPhotosAtomic(params: ReorderGalleryPhotosParams): Promise<boolean> {
    const release = await this.acquireLock(params.barbershopId);
    try {
      for (let order = 0; order < params.itemIds.length; order++) {
        const item = this.items.find(
          (i) =>
            i.id.toString() === params.itemIds[order] &&
            i.barbershopId.toString() === params.barbershopId
        );
        if (item) {
          item.changeOrder(order);
        }
      }
      return true;
    } finally {
      release();
    }
  }

  async setCoverPhotoAtomic(params: SetCoverPhotoParams): Promise<boolean> {
    const release = await this.acquireLock(params.barbershopId);
    try {
      const item = this.items.find(
        (i) =>
          i.id.toString() === params.galleryItemId &&
          i.barbershopId.toString() === params.barbershopId
      );
      if (!item) {
        return false;
      }
      await this.clearCover(params.barbershopId);
      item.setCover(true);
      return true;
    } finally {
      release();
    }
  }
}
