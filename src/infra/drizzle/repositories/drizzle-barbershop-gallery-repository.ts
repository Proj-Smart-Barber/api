import { eq, and, asc, count, sql } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { barbershopGallery, media, barbershops } from "../schema";
import { BarbershopGalleryMapper } from "../../../domain/enterprise/mappers/barbershop-gallery-mapper";
import type {
  BarbershopGalleryRepository,
  AddGalleryPhotoParams,
  AddGalleryPhotoResult,
  RemoveGalleryPhotoParams,
  RemoveGalleryPhotoResult,
  ReorderGalleryPhotosParams,
  SetCoverPhotoParams,
} from "../../../domain/application/repositories/barbershop-gallery-repository";
import type { BarbershopGalleryItem } from "../../../domain/enterprise/entities/barbershop-gallery-item";

export class DrizzleBarbershopGalleryRepository implements BarbershopGalleryRepository {
  constructor(private db = defaultDb) {}

  async create(entity: BarbershopGalleryItem): Promise<void> {
    const data = BarbershopGalleryMapper.toPersistence(entity);
    await this.db.transaction(async (tx) => {
      if (entity.isCover) {
        await tx
          .update(barbershopGallery)
          .set({ isCover: false, updatedAt: new Date() })
          .where(
            and(
              eq(barbershopGallery.barbershopId, entity.barbershopId.toString()),
              eq(barbershopGallery.isCover, true)
            )
          );
      }
      await tx.insert(barbershopGallery).values(data);
    });
  }

  async findById(id: string): Promise<BarbershopGalleryItem | null> {
    const [row] = await this.db
      .select()
      .from(barbershopGallery)
      .where(eq(barbershopGallery.id, id));
    if (!row) return null;
    return BarbershopGalleryMapper.toDomain(row);
  }

  async findByBarbershopId(barbershopId: string): Promise<BarbershopGalleryItem[]> {
    const rows = await this.db
      .select({
        id: barbershopGallery.id,
        barbershopId: barbershopGallery.barbershopId,
        mediaId: barbershopGallery.mediaId,
        displayOrder: barbershopGallery.displayOrder,
        caption: barbershopGallery.caption,
        isCover: barbershopGallery.isCover,
        createdAt: barbershopGallery.createdAt,
        updatedAt: barbershopGallery.updatedAt,
        publicUrl: media.publicUrl,
      })
      .from(barbershopGallery)
      .leftJoin(media, eq(barbershopGallery.mediaId, media.id))
      .where(eq(barbershopGallery.barbershopId, barbershopId))
      .orderBy(asc(barbershopGallery.displayOrder));

    return rows.map(BarbershopGalleryMapper.toDomain);
  }

  async findByBarbershopIdAndMediaId(
    barbershopId: string,
    mediaId: string
  ): Promise<BarbershopGalleryItem | null> {
    const [row] = await this.db
      .select()
      .from(barbershopGallery)
      .where(
        and(
          eq(barbershopGallery.barbershopId, barbershopId),
          eq(barbershopGallery.mediaId, mediaId)
        )
      );

    if (!row) return null;
    return BarbershopGalleryMapper.toDomain(row);
  }

  async save(entity: BarbershopGalleryItem): Promise<void> {
    const data = BarbershopGalleryMapper.toPersistence(entity);
    await this.db
      .update(barbershopGallery)
      .set(data)
      .where(eq(barbershopGallery.id, entity.id.toString()));
  }

  async saveMany(items: BarbershopGalleryItem[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const item of items) {
        const data = BarbershopGalleryMapper.toPersistence(item);
        await tx
          .update(barbershopGallery)
          .set(data)
          .where(eq(barbershopGallery.id, item.id.toString()));
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(barbershopGallery).where(eq(barbershopGallery.id, id));
  }

  async countByBarbershopId(barbershopId: string): Promise<number> {
    const [res] = await this.db
      .select({ count: count() })
      .from(barbershopGallery)
      .where(eq(barbershopGallery.barbershopId, barbershopId));

    return res?.count ?? 0;
  }

  async clearCover(barbershopId: string): Promise<void> {
    await this.db
      .update(barbershopGallery)
      .set({ isCover: false, updatedAt: new Date() })
      .where(eq(barbershopGallery.barbershopId, barbershopId));
  }

  async addPhotoAtomic(params: AddGalleryPhotoParams): Promise<AddGalleryPhotoResult> {
    return await this.db.transaction(async (tx) => {
      // 1. Lock the barbershop row (serializes all gallery modifications for this barbershop)
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${params.barbershopId} FOR UPDATE`
      );

      // 2. Check idempotency: if (barbershopId, mediaId) already exists, return it safely
      const [existing] = await tx
        .select({
          id: barbershopGallery.id,
          barbershopId: barbershopGallery.barbershopId,
          mediaId: barbershopGallery.mediaId,
          displayOrder: barbershopGallery.displayOrder,
          caption: barbershopGallery.caption,
          isCover: barbershopGallery.isCover,
          createdAt: barbershopGallery.createdAt,
          updatedAt: barbershopGallery.updatedAt,
          publicUrl: media.publicUrl,
        })
        .from(barbershopGallery)
        .leftJoin(media, eq(barbershopGallery.mediaId, media.id))
        .where(
          and(
            eq(barbershopGallery.barbershopId, params.barbershopId),
            eq(barbershopGallery.mediaId, params.mediaId)
          )
        );

      if (existing) {
        return {
          success: true,
          item: BarbershopGalleryMapper.toDomain(existing),
          isDuplicate: true,
        };
      }

      // 3. Count existing photos under lock
      const [countRes] = await tx
        .select({ count: count() })
        .from(barbershopGallery)
        .where(eq(barbershopGallery.barbershopId, params.barbershopId));

      const currentCount = countRes?.count ?? 0;
      if (currentCount >= params.maxPhotos) {
        return { success: false, reason: "LIMIT_EXCEEDED" };
      }

      const shouldBeCover = params.isCover || currentCount === 0;

      // 4. Atomic cover handling
      if (shouldBeCover) {
        await tx
          .update(barbershopGallery)
          .set({ isCover: false, updatedAt: new Date() })
          .where(
            and(
              eq(barbershopGallery.barbershopId, params.barbershopId),
              eq(barbershopGallery.isCover, true)
            )
          );
      }

      // 5. Insert new photo
      const [inserted] = await tx
        .insert(barbershopGallery)
        .values({
          barbershopId: params.barbershopId,
          mediaId: params.mediaId,
          displayOrder: currentCount,
          caption: params.caption ?? null,
          isCover: shouldBeCover,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 6. Update barbershop cover projection atomically
      if (shouldBeCover) {
        await tx
          .update(barbershops)
          .set({ coverUrl: params.publicUrl })
          .where(eq(barbershops.id, params.barbershopId));
      }

      const itemWithUrl = {
        ...inserted,
        publicUrl: params.publicUrl,
      };

      return {
        success: true,
        item: BarbershopGalleryMapper.toDomain(itemWithUrl),
        isDuplicate: false,
      };
    });
  }

  async removePhotoAtomic(params: RemoveGalleryPhotoParams): Promise<RemoveGalleryPhotoResult> {
    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${params.barbershopId} FOR UPDATE`
      );

      const [target] = await tx
        .select()
        .from(barbershopGallery)
        .where(
          and(
            eq(barbershopGallery.id, params.galleryItemId),
            eq(barbershopGallery.barbershopId, params.barbershopId)
          )
        );

      if (!target) {
        return { success: false, reason: "NOT_FOUND" };
      }

      await tx.delete(barbershopGallery).where(eq(barbershopGallery.id, target.id));

      let newCoverPublicUrl: string | null = null;

      if (target.isCover) {
        const [nextCover] = await tx
          .select({
            id: barbershopGallery.id,
            publicUrl: media.publicUrl,
          })
          .from(barbershopGallery)
          .leftJoin(media, eq(barbershopGallery.mediaId, media.id))
          .where(eq(barbershopGallery.barbershopId, params.barbershopId))
          .orderBy(asc(barbershopGallery.displayOrder))
          .limit(1);

        if (nextCover) {
          await tx
            .update(barbershopGallery)
            .set({ isCover: true, updatedAt: new Date() })
            .where(eq(barbershopGallery.id, nextCover.id));

          newCoverPublicUrl = nextCover.publicUrl;
          await tx
            .update(barbershops)
            .set({ coverUrl: newCoverPublicUrl })
            .where(eq(barbershops.id, params.barbershopId));
        } else {
          await tx
            .update(barbershops)
            .set({ coverUrl: null })
            .where(eq(barbershops.id, params.barbershopId));
        }
      }

      return { success: true, newCoverPublicUrl };
    });
  }

  async reorderPhotosAtomic(params: ReorderGalleryPhotosParams): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${params.barbershopId} FOR UPDATE`
      );

      for (let order = 0; order < params.itemIds.length; order++) {
        await tx
          .update(barbershopGallery)
          .set({ displayOrder: order, updatedAt: new Date() })
          .where(
            and(
              eq(barbershopGallery.id, params.itemIds[order]),
              eq(barbershopGallery.barbershopId, params.barbershopId)
            )
          );
      }

      return true;
    });
  }

  async setCoverPhotoAtomic(params: SetCoverPhotoParams): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${params.barbershopId} FOR UPDATE`
      );

      const [target] = await tx
        .select({ id: barbershopGallery.id })
        .from(barbershopGallery)
        .where(
          and(
            eq(barbershopGallery.id, params.galleryItemId),
            eq(barbershopGallery.barbershopId, params.barbershopId)
          )
        );

      if (!target) {
        return false;
      }

      await tx
        .update(barbershopGallery)
        .set({ isCover: false, updatedAt: new Date() })
        .where(
          and(
            eq(barbershopGallery.barbershopId, params.barbershopId),
            eq(barbershopGallery.isCover, true)
          )
        );

      await tx
        .update(barbershopGallery)
        .set({ isCover: true, updatedAt: new Date() })
        .where(eq(barbershopGallery.id, params.galleryItemId));

      await tx
        .update(barbershops)
        .set({ coverUrl: params.publicUrl })
        .where(eq(barbershops.id, params.barbershopId));

      return true;
    });
  }
}
