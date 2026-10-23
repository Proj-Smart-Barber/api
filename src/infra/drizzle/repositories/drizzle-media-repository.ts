import { eq, and, or, lt, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { media } from "../schema";
import { MediaMapper } from "../../../domain/enterprise/mappers/media-mapper";
import type {
  MediaRepository,
  ClaimProcessingResult,
  FinalizeProcessingData,
} from "../../../domain/application/repositories/media-repository";
import type { Media } from "../../../domain/enterprise/entities/media";

export class DrizzleMediaRepository implements MediaRepository {
  constructor(private db = defaultDb) {}

  async create(entity: Media): Promise<void> {
    const data = MediaMapper.toPersistence(entity);
    await this.db.insert(media).values(data);
  }

  async findById(id: string): Promise<Media | null> {
    const [row] = await this.db.select().from(media).where(eq(media.id, id));
    if (!row) return null;
    return MediaMapper.toDomain(row);
  }

  async findByObjectKey(objectKey: string): Promise<Media | null> {
    const [row] = await this.db.select().from(media).where(eq(media.objectKey, objectKey));
    if (!row) return null;
    return MediaMapper.toDomain(row);
  }

  async save(entity: Media): Promise<void> {
    const data = MediaMapper.toPersistence(entity);
    await this.db.update(media).set(data).where(eq(media.id, entity.id.toString()));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(media).where(eq(media.id, id));
  }

  async claimForProcessing(
    id: string,
    params: { leaseToken: string; leaseDurationMs: number }
  ): Promise<ClaimProcessingResult> {
    const expiresAt = new Date(Date.now() + params.leaseDurationMs);
    const rows = await this.db
      .update(media)
      .set({
        status: "PROCESSING",
        generation: sql`${media.generation} + 1`,
        leaseToken: params.leaseToken,
        leaseExpiresAt: expiresAt,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(media.id, id),
          or(
            eq(media.status, "PENDING"),
            and(
              eq(media.status, "PROCESSING"),
              or(
                isNull(media.leaseExpiresAt),
                lt(media.leaseExpiresAt, new Date())
              )
            )
          )
        )
      )
      .returning();

    if (rows.length === 0) {
      return { claimed: false };
    }

    return {
      claimed: true,
      media: MediaMapper.toDomain(rows[0]),
    };
  }

  async releaseProcessing(
    id: string,
    leaseToken: string,
    options?: { resetToPending?: boolean; errorMessage?: string }
  ): Promise<boolean> {
    const updateData: any = {
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    };
    if (options?.resetToPending) {
      updateData.status = "PENDING";
      updateData.retryCount = sql`${media.retryCount} + 1`;
    }
    if (options?.errorMessage !== undefined) {
      updateData.errorMessage = options.errorMessage;
    }

    const rows = await this.db
      .update(media)
      .set(updateData)
      .where(and(eq(media.id, id), eq(media.leaseToken, leaseToken)))
      .returning({ id: media.id });

    return rows.length > 0;
  }

  async finalizeProcessing(
    id: string,
    leaseToken: string,
    data: FinalizeProcessingData
  ): Promise<boolean> {
    const rows = await this.db
      .update(media)
      .set({
        status: "READY",
        objectKey: data.objectKey,
        publicUrl: data.publicUrl,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        width: data.width ?? null,
        height: data.height ?? null,
        variants: data.variants,
        generation: data.generation,
        leaseToken: null,
        leaseExpiresAt: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(and(eq(media.id, id), eq(media.leaseToken, leaseToken)))
      .returning({ id: media.id });

    return rows.length > 0;
  }

  async rejectProcessing(
    id: string,
    leaseToken: string,
    reason: string
  ): Promise<boolean> {
    const rows = await this.db
      .update(media)
      .set({
        status: "REJECTED",
        errorMessage: reason,
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(media.id, id), eq(media.leaseToken, leaseToken)))
      .returning({ id: media.id });

    return rows.length > 0;
  }

  async markExpiredConditional(
    id: string,
    params: { allowedStatuses: string[]; currentGeneration: number }
  ): Promise<boolean> {
    const rows = await this.db
      .update(media)
      .set({
        status: "EXPIRED",
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(media.id, id),
          eq(media.generation, params.currentGeneration),
          inArray(media.status, params.allowedStatuses as any)
        )
      )
      .returning({ id: media.id });

    return rows.length > 0;
  }

  async findOrphans(olderThanDate: Date, limit: number): Promise<Media[]> {
    const rows = await this.db
      .select()
      .from(media)
      .where(
        or(
          and(eq(media.status, "PENDING"), lt(media.createdAt, olderThanDate)),
          and(
            eq(media.status, "PROCESSING"),
            or(
              and(isNotNull(media.leaseExpiresAt), lt(media.leaseExpiresAt, new Date())),
              lt(media.updatedAt, olderThanDate)
            )
          ),
          and(eq(media.status, "REJECTED"), lt(media.updatedAt, olderThanDate))
        )
      )
      .limit(limit);

    return rows.map(MediaMapper.toDomain);
  }

  async countPendingByOwnerId(ownerId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(media)
      .where(and(eq(media.ownerId, ownerId), eq(media.status, "PENDING")));

    return rows.length;
  }
}
