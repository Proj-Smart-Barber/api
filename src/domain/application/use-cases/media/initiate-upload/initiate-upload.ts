import { randomUUID } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Media, type MediaPurpose } from "../../../../enterprise/entities/media";
import { Role } from "../../../../enterprise/entities/membership";
import type { MediaRepository } from "../../../repositories/media-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { StorageService } from "../../../services/storage-service";

export interface InitiateMediaUploadDTO {
  userId: string;
  purpose: MediaPurpose;
  fileName: string;
  mimeType: string;
  fileSize: number;
  barbershopId?: string;
}

export interface InitiateMediaUploadResponse {
  mediaId: string;
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

export class InitiateMediaUploadUseCase {
  private readonly MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly MAX_SPACE_SIZE = 10 * 1024 * 1024; // 10 MB
  private readonly ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

  constructor(
    private mediaRepository: MediaRepository,
    private storageService: StorageService,
    private membershipsRepository?: MembershipsRepository
  ) {}

  async execute(dto: InitiateMediaUploadDTO): Promise<Either<Error, InitiateMediaUploadResponse>> {
    // 1. Check HEIC
    const lowerMime = dto.mimeType.toLowerCase();
    const lowerName = dto.fileName.toLowerCase();
    if (
      lowerMime.includes("heic") ||
      lowerMime.includes("heif") ||
      lowerName.endsWith(".heic") ||
      lowerName.endsWith(".heif")
    ) {
      return left(
        new Error(
          "Formato HEIC não suportado diretamente. Por favor, converta para JPEG, PNG ou WebP antes do envio."
        )
      );
    }

    // 2. Validate MIME
    if (!this.ALLOWED_MIME_TYPES.includes(lowerMime)) {
      return left(
        new Error("Formato de imagem não suportado. Apenas JPEG, PNG e WebP são aceitos.")
      );
    }

    // 3. Validate size limits
    const isSmallMedia = dto.purpose === "USER_AVATAR" || dto.purpose === "BARBERSHOP_LOGO";
    const maxAllowedSize = isSmallMedia ? this.MAX_AVATAR_SIZE : this.MAX_SPACE_SIZE;

    if (dto.fileSize <= 0) {
      return left(new Error("O arquivo não pode ser vazio."));
    }

    if (dto.fileSize > maxAllowedSize) {
      const maxMb = maxAllowedSize / (1024 * 1024);
      return left(
        new Error(
          `Tamanho do arquivo excede o limite de ${maxMb} MB permitido para ${dto.purpose}.`
        )
      );
    }

    // 4. Barbershop authorization check (F04)
    const isBarbershopMedia =
      dto.purpose === "BARBERSHOP_LOGO" ||
      dto.purpose === "BARBERSHOP_COVER" ||
      dto.purpose === "BARBERSHOP_GALLERY";

    if (isBarbershopMedia) {
      if (!dto.barbershopId) {
        return left(new Error("barbershopId é obrigatório para uploads da barbearia."));
      }

      if (this.membershipsRepository) {
        const members = await this.membershipsRepository.findManyByBarbershopId(dto.barbershopId);
        const activeOwner = members.find(
          (m) => m.userId.toString() === dto.userId && m.role === Role.OWNER && m.state === "ACTIVE"
        );
        if (!activeOwner) {
          return left(
            new Error("Apenas o proprietário ativo da unidade pode iniciar upload para a barbearia.")
          );
        }
      }
    }

    // 5. Abuse prevention / active intent guard (T05)
    const pendingCount = await this.mediaRepository.countPendingByOwnerId(dto.userId);
    if (pendingCount >= 2) {
      return left(
        new Error("Limite de uploads simultâneos atingido (máximo 2). Conclua ou aguarde o upload anterior.")
      );
    }

    // 6. Generate unique staging key in private staging bucket (F03)
    const mediaId = randomUUID();
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stagingKey = `staging/${mediaId}/${sanitizedFileName}`;

    // 7. Generate presigned upload URL via StorageService (valid for 5 minutes)
    const uploadResult = await this.storageService.generateUploadUrl({
      objectKey: stagingKey,
      mimeType: lowerMime,
      fileSize: dto.fileSize,
      expiresInSeconds: 300,
    });

    // 8. Create pending media entity
    const media = Media.create(
      {
        ownerId: new UniqueEntityId(dto.userId),
        ownerType: isBarbershopMedia ? "BARBERSHOP" : "USER",
        ownerEntityId: isBarbershopMedia && dto.barbershopId ? new UniqueEntityId(dto.barbershopId) : new UniqueEntityId(dto.userId),
        purpose: dto.purpose,
        objectKey: stagingKey,
        publicUrl: uploadResult.publicUrl,
        mimeType: lowerMime,
        fileSize: dto.fileSize,
        status: "PENDING",
      },
      new UniqueEntityId(mediaId)
    );

    await this.mediaRepository.create(media);

    return right({
      mediaId: media.id.toString(),
      uploadUrl: uploadResult.uploadUrl,
      publicUrl: uploadResult.publicUrl,
      objectKey: stagingKey,
    });
  }
}
