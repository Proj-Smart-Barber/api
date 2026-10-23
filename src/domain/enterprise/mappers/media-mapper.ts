// biome-ignore lint/complexity/noStaticOnlyClass: Domain mapper pattern
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Media, type MediaPurpose, type MediaStatus } from "../entities/media";

export class MediaMapper {
  static toDomain(raw: any): Media {
    return Media.create(
      {
        ownerId: new UniqueEntityId(raw.ownerId ?? raw.owner_id),
        ownerType: raw.ownerType ?? raw.owner_type ?? "USER",
        ownerEntityId: raw.ownerEntityId ?? raw.owner_entity_id ? new UniqueEntityId(raw.ownerEntityId ?? raw.owner_entity_id) : undefined,
        purpose: (raw.purpose as MediaPurpose) ?? "USER_AVATAR",
        objectKey: raw.objectKey ?? raw.object_key,
        publicUrl: raw.publicUrl ?? raw.public_url,
        mimeType: raw.mimeType ?? raw.mime_type,
        fileSize: raw.fileSize ?? raw.file_size,
        width: raw.width ?? undefined,
        height: raw.height ?? undefined,
        generation: raw.generation ?? 1,
        variants: typeof raw.variants === "string" ? JSON.parse(raw.variants) : (raw.variants ?? undefined),
        leaseToken: raw.leaseToken ?? raw.lease_token ?? undefined,
        leaseExpiresAt: raw.leaseExpiresAt ?? raw.lease_expires_at ? new Date(raw.leaseExpiresAt ?? raw.lease_expires_at) : undefined,
        retryCount: raw.retryCount ?? raw.retry_count ?? 0,
        errorMessage: raw.errorMessage ?? raw.error_message ?? undefined,
        status: (raw.status as MediaStatus) ?? "PENDING",
        createdAt: new Date(raw.createdAt ?? raw.created_at),
        updatedAt: new Date(raw.updatedAt ?? raw.updated_at),
      },
      new UniqueEntityId(raw.id)
    );
  }

  static toPersistence(media: Media): any {
    return {
      id: media.id.toString(),
      ownerId: media.ownerId.toString(),
      ownerType: media.ownerType,
      ownerEntityId: media.ownerEntityId ? media.ownerEntityId.toString() : null,
      purpose: media.purpose,
      objectKey: media.objectKey,
      publicUrl: media.publicUrl,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      width: media.width ?? null,
      height: media.height ?? null,
      generation: media.generation,
      variants: media.variants ?? null,
      leaseToken: media.leaseToken ?? null,
      leaseExpiresAt: media.leaseExpiresAt ?? null,
      retryCount: media.retryCount ?? 0,
      errorMessage: media.errorMessage ?? null,
      status: media.status,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }
}
