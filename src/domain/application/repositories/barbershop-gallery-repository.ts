import type { BarbershopGalleryItem } from "../../enterprise/entities/barbershop-gallery-item";

export type AddGalleryPhotoResult =
  | { success: true; item: BarbershopGalleryItem; isDuplicate: boolean }
  | { success: false; reason: "LIMIT_EXCEEDED" };

export interface AddGalleryPhotoParams {
  barbershopId: string;
  mediaId: string;
  caption?: string;
  isCover?: boolean;
  publicUrl: string;
  maxPhotos: number;
}

export interface RemoveGalleryPhotoParams {
  barbershopId: string;
  galleryItemId: string;
}

export type RemoveGalleryPhotoResult =
  | { success: true; newCoverPublicUrl?: string | null }
  | { success: false; reason: "NOT_FOUND" };

export interface ReorderGalleryPhotosParams {
  barbershopId: string;
  itemIds: string[];
}

export interface SetCoverPhotoParams {
  barbershopId: string;
  galleryItemId: string;
  publicUrl: string;
}

export interface BarbershopGalleryRepository {
  create(item: BarbershopGalleryItem): Promise<void>;
  findById(id: string): Promise<BarbershopGalleryItem | null>;
  findByBarbershopId(barbershopId: string): Promise<BarbershopGalleryItem[]>;
  findByBarbershopIdAndMediaId(
    barbershopId: string,
    mediaId: string
  ): Promise<BarbershopGalleryItem | null>;
  save(item: BarbershopGalleryItem): Promise<void>;
  saveMany(items: BarbershopGalleryItem[]): Promise<void>;
  delete(id: string): Promise<void>;
  countByBarbershopId(barbershopId: string): Promise<number>;
  clearCover(barbershopId: string): Promise<void>;

  // Atomic database-coordinated operations (A01)
  addPhotoAtomic(params: AddGalleryPhotoParams): Promise<AddGalleryPhotoResult>;
  removePhotoAtomic(params: RemoveGalleryPhotoParams): Promise<RemoveGalleryPhotoResult>;
  reorderPhotosAtomic(params: ReorderGalleryPhotosParams): Promise<boolean>;
  setCoverPhotoAtomic(params: SetCoverPhotoParams): Promise<boolean>;
}
