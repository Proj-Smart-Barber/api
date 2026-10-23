import { randomUUID } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import type { Media, MediaVariantInfo } from "../../../../enterprise/entities/media";
import type { MediaRepository } from "../../../repositories/media-repository";
import type { StorageService } from "../../../services/storage-service";
import type { ImageProcessorService } from "../../../services/image-processor-service";

export interface ConfirmMediaUploadDTO {
  userId: string;
  mediaId: string;
}

export interface ConfirmMediaUploadResponse {
  media: Media;
}

export class ConfirmMediaUploadUseCase {
  private readonly MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MiB
  private readonly MAX_SPACE_SIZE = 10 * 1024 * 1024; // 10 MiB
  private readonly LEASE_DURATION_MS = 300_000; // 5 minutos

  constructor(
    private mediaRepository: MediaRepository,
    private storageService: StorageService,
    private imageProcessor: ImageProcessorService
  ) {}

  async execute(dto: ConfirmMediaUploadDTO): Promise<Either<Error, ConfirmMediaUploadResponse>> {
    const current = await this.mediaRepository.findById(dto.mediaId);
    if (!current) {
      return left(new Error("Mídia não encontrada."));
    }

    if (!current.isOwnedBy(new UniqueEntityId(dto.userId))) {
      return left(new Error("Não autorizado a confirmar esta mídia."));
    }

    if (current.status === "READY") {
      return right({ media: current });
    }

    if (current.status === "PROCESSING" && !current.isLeaseExpired()) {
      return left(new Error("Mídia já está sendo processada por outra operação."));
    }

    if (current.status === "REJECTED") {
      return left(
        new Error("Esta mídia foi rejeitada anteriormente por não atender aos requisitos de segurança.")
      );
    }

    if (current.status === "EXPIRED" || current.status === "CANCELLED") {
      return left(new Error("Esta operação de upload expirou ou foi cancelada."));
    }

    const leaseToken = randomUUID();

    // 1. Reivindicação atômica de PROCESSING (CAS lease)
    const claim = await this.mediaRepository.claimForProcessing(dto.mediaId, {
      leaseToken,
      leaseDurationMs: this.LEASE_DURATION_MS,
    });

    if (!claim.claimed || !claim.media) {
      return left(new Error("Mídia não está disponível para confirmação ou já está em processamento."));
    }

    const media = claim.media;

    if (!media.isOwnedBy(new UniqueEntityId(dto.userId))) {
      await this.mediaRepository.releaseProcessing(media.id.toString(), leaseToken, {
        resetToPending: true,
      });
      return left(new Error("Não autorizado a confirmar esta mídia."));
    }

    // Calculate maximum allowed size based on purpose
    const isSmallMedia = media.purpose === "USER_AVATAR" || media.purpose === "BARBERSHOP_LOGO";
    const maxAllowedSize = isSmallMedia ? this.MAX_AVATAR_SIZE : this.MAX_SPACE_SIZE;

    const stagingKey = media.objectKey;

    // Inspect & read staging object with byte limit protection
    const inspection = await this.storageService.inspectStagingObject(stagingKey, maxAllowedSize);
    if (!inspection.exists) {
      // Objeto ainda ausente no staging: libera lease e reseta para PENDING para permitir retentativa
      await this.mediaRepository.releaseProcessing(media.id.toString(), leaseToken, {
        resetToPending: true,
        errorMessage: "Arquivo não encontrado no armazenamento de upload.",
      });
      return left(new Error("Arquivo não encontrado no armazenamento de upload."));
    }

    if (inspection.truncated || inspection.size > maxAllowedSize) {
      const maxMb = maxAllowedSize / (1024 * 1024);
      const reason = `Tamanho efetivo do arquivo excede o limite máximo permitido de ${maxMb} MB para ${media.purpose}.`;
      await this.mediaRepository.rejectProcessing(media.id.toString(), leaseToken, reason);
      await this.storageService.deleteStagingObject(stagingKey).catch(() => {});
      return left(new Error(reason));
    }

    if (!inspection.buffer || inspection.buffer.length === 0) {
      const reason = "Conteúdo do arquivo não pôde ser lido para verificação.";
      await this.mediaRepository.rejectProcessing(media.id.toString(), leaseToken, reason);
      return left(new Error(reason));
    }

    // Process image variants (decoding, orientation normalization, EXIF stripping, resizing)
    const processResult = await this.imageProcessor.processImage(inspection.buffer, media.purpose);
    if (!processResult.valid || processResult.variants.length === 0) {
      const reason = processResult.error ?? "Arquivo de imagem inválido ou corrompido.";
      await this.mediaRepository.rejectProcessing(media.id.toString(), leaseToken, reason);
      await this.storageService.deleteStagingObject(stagingKey).catch(() => {});
      return left(new Error(reason));
    }

    const mainVariant = processResult.variants.find((v) => v.name === "main")!;
    const thumbVariant = processResult.variants.find((v) => v.name === "thumbnail");

    const mainExt = mainVariant.format === "jpeg" ? "jpg" : mainVariant.format;
    const generation = media.generation;
    const immutableMainKey = `variants/${media.id.toString()}/${generation}/main.${mainExt}`;

    // Persist processed variants to immutable public storage
    const savedMain = await this.storageService.saveVariant({
      objectKey: immutableMainKey,
      buffer: mainVariant.buffer,
      mimeType: mainVariant.mimeType,
    });

    let savedThumb: { publicUrl: string; objectKey: string } | undefined;
    let immutableThumbKey: string | undefined;

    if (thumbVariant) {
      const thumbExt = thumbVariant.format === "jpeg" ? "jpg" : thumbVariant.format;
      immutableThumbKey = `variants/${media.id.toString()}/${generation}/thumb.${thumbExt}`;
      savedThumb = await this.storageService.saveVariant({
        objectKey: immutableThumbKey,
        buffer: thumbVariant.buffer,
        mimeType: thumbVariant.mimeType,
      });
    }

    const variants: Record<string, MediaVariantInfo> = {
      main: {
        objectKey: immutableMainKey,
        publicUrl: savedMain.publicUrl,
        width: mainVariant.width,
        height: mainVariant.height,
        fileSize: mainVariant.fileSize,
        mimeType: mainVariant.mimeType,
      },
    };

    if (thumbVariant && savedThumb && immutableThumbKey) {
      variants.thumbnail = {
        objectKey: immutableThumbKey,
        publicUrl: savedThumb.publicUrl,
        width: thumbVariant.width,
        height: thumbVariant.height,
        fileSize: thumbVariant.fileSize,
        mimeType: thumbVariant.mimeType,
      };
    }

    // Finalização atômica conferindo leaseToken e generation
    const finalized = await this.mediaRepository.finalizeProcessing(
      media.id.toString(),
      leaseToken,
      {
        objectKey: immutableMainKey,
        publicUrl: savedMain.publicUrl,
        fileSize: mainVariant.fileSize,
        mimeType: mainVariant.mimeType,
        width: mainVariant.width,
        height: mainVariant.height,
        variants,
        generation,
      }
    );

    if (!finalized) {
      return left(
        new Error("Conflito de concorrência ou lease expirado ao finalizar o processamento da mídia.")
      );
    }

    // Clean up temporary private staging object estritamente APÓS commit bem-sucedido no banco
    await this.storageService.deleteStagingObject(stagingKey).catch(() => {});

    media.finalizeReady({
      objectKey: immutableMainKey,
      publicUrl: savedMain.publicUrl,
      fileSize: mainVariant.fileSize,
      mimeType: mainVariant.mimeType,
      width: mainVariant.width,
      height: mainVariant.height,
      variants,
    });

    return right({ media });
  }
}
