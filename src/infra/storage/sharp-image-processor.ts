import sharp from "sharp";
import { createHash } from "node:crypto";
import type {
  ImageProcessorService,
  ImageInspectionResult,
  ImageVariant,
  ProcessImageResult,
  AllowedImageFormat,
} from "../../domain/application/services/image-processor-service";
import type { MediaPurpose } from "../../domain/enterprise/entities/media";

export class SharpImageProcessor implements ImageProcessorService {
  private readonly MAX_DIMENSION = 4096;
  private readonly MAX_PIXELS = 16_000_000;
  private readonly ALLOWED_FORMATS: AllowedImageFormat[] = ["jpeg", "png", "webp"];

  async validateAndInspect(buffer: Buffer): Promise<ImageInspectionResult> {
    if (!buffer || buffer.length < 24) {
      return {
        valid: false,
        error: "Arquivo de imagem truncado ou corrompido.",
      };
    }

    try {
      const instance = sharp(buffer);
      const metadata = await instance.metadata();

      if (!metadata.format) {
        return {
          valid: false,
          error: "Não foi possível identificar o formato da imagem.",
        };
      }

      const formatLower = metadata.format.toLowerCase();
      if (formatLower === "heif" || formatLower === "heic") {
        return {
          valid: false,
          error:
            "Formato HEIC do iPhone não é suportado diretamente. Converta para JPEG, PNG ou WebP antes do envio.",
        };
      }

      if (!this.ALLOWED_FORMATS.includes(formatLower as AllowedImageFormat)) {
        return {
          valid: false,
          error: `Formato '${metadata.format}' não suportado. Apenas JPEG, PNG e WebP são aceitos.`,
        };
      }

      const format = (formatLower === "jpg" ? "jpeg" : formatLower) as AllowedImageFormat;

      // Single frame check
      if (metadata.pages && metadata.pages > 1) {
        return {
          valid: false,
          error: "Imagens com múltiplas páginas ou animações não são permitidas.",
        };
      }

      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      if (width <= 0 || height <= 0) {
        return {
          valid: false,
          error: "Dimensões da imagem inválidas.",
        };
      }

      if (width > this.MAX_DIMENSION || height > this.MAX_DIMENSION) {
        return {
          valid: false,
          error: `Dimensão da imagem excede o limite máximo de ${this.MAX_DIMENSION} px.`,
        };
      }

      if (width * height > this.MAX_PIXELS) {
        return {
          valid: false,
          error: `Total de pixels excede o limite máximo de ${this.MAX_PIXELS.toLocaleString()} pixels.`,
        };
      }

      // Prove that image can actually be decoded completely (detects truncated PNG/JPEG)
      await instance.rotate().toBuffer();

      const mimeType = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";

      return {
        valid: true,
        format,
        mimeType,
        width,
        height,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Arquivo de imagem inválido ou corrompido: ${err?.message || String(err)}`,
      };
    }
  }

  private async optimizeBufferUnderBudget(
    pipeline: sharp.Sharp,
    maxBytes: number,
    preferredFormat: AllowedImageFormat
  ): Promise<{ buffer: Buffer; format: AllowedImageFormat; mimeType: string }> {
    let currentFormat = preferredFormat;
    const qualities = [82, 70, 58];

    let buf: Buffer;
    if (currentFormat === "png") {
      buf = await pipeline.clone().png({ compressionLevel: 9 }).toBuffer();
      if (buf.length <= maxBytes) {
        return { buffer: buf, format: "png", mimeType: "image/png" };
      }
      // If noisy PNG exceeds budget, gracefully convert to WebP with alpha preservation
      currentFormat = "webp";
    }

    for (const q of qualities) {
      buf = await pipeline.clone().webp({ quality: q, alphaQuality: 90 }).toBuffer();
      if (buf.length <= maxBytes) {
        return {
          buffer: buf,
          format: currentFormat,
          mimeType: currentFormat === "jpeg" ? "image/jpeg" : "image/webp",
        };
      }
    }

    // Try quality 45 before refusing
    buf = await pipeline.clone().webp({ quality: 45, alphaQuality: 80 }).toBuffer();
    if (buf.length <= maxBytes) {
      return {
        buffer: buf,
        format: currentFormat,
        mimeType: currentFormat === "jpeg" ? "image/jpeg" : "image/webp",
      };
    }

    throw new Error(
      `Imagem excede o orçamento de saída permitido de ${Math.round(maxBytes / 1024)} KiB mesmo após compressão máxima.`
    );
  }

  async stripExif(buffer: Buffer, format: AllowedImageFormat): Promise<Buffer> {
    const pipeline = sharp(buffer).rotate();
    if (format === "jpeg") {
      return pipeline.jpeg({ quality: 85 }).toBuffer();
    }
    if (format === "png") {
      return pipeline.png({ compressionLevel: 8 }).toBuffer();
    }
    return pipeline.webp({ quality: 85 }).toBuffer();
  }

  async processImage(buffer: Buffer, purpose: MediaPurpose): Promise<ProcessImageResult> {
    const inspection = await this.validateAndInspect(buffer);
    if (!inspection.valid || !inspection.format || !inspection.width || !inspection.height) {
      return {
        valid: false,
        format: inspection.format ?? "jpeg",
        mimeType: inspection.mimeType ?? "image/jpeg",
        width: 0,
        height: 0,
        variants: [],
        error: inspection.error ?? "Falha na validação da imagem.",
      };
    }

    const format = inspection.format;
    const variants: ImageVariant[] = [];

    try {
      if (purpose === "USER_AVATAR") {
        // Avatar: Square crop, main 512x512 (max 300 KiB), thumb 256x256 (max 100 KiB)
        const mainPipeline = sharp(buffer)
          .rotate()
          .resize(512, 512, { fit: "cover", position: "centre", withoutEnlargement: true });

        const thumbPipeline = sharp(buffer)
          .rotate()
          .resize(256, 256, { fit: "cover", position: "centre", withoutEnlargement: true });

        const optimizedMain = await this.optimizeBufferUnderBudget(mainPipeline, 300 * 1024, "webp");
        const optimizedThumb = await this.optimizeBufferUnderBudget(thumbPipeline, 100 * 1024, "webp");

        const mainMeta = await sharp(optimizedMain.buffer).metadata();
        const thumbMeta = await sharp(optimizedThumb.buffer).metadata();

        variants.push({
          name: "main",
          buffer: optimizedMain.buffer,
          width: mainMeta.width ?? 512,
          height: mainMeta.height ?? 512,
          fileSize: optimizedMain.buffer.length,
          mimeType: optimizedMain.mimeType,
          format: optimizedMain.format,
          sha256: createHash("sha256").update(optimizedMain.buffer).digest("hex"),
        });

        variants.push({
          name: "thumbnail",
          buffer: optimizedThumb.buffer,
          width: thumbMeta.width ?? 256,
          height: thumbMeta.height ?? 256,
          fileSize: optimizedThumb.buffer.length,
          mimeType: optimizedThumb.mimeType,
          format: optimizedThumb.format,
          sha256: createHash("sha256").update(optimizedThumb.buffer).digest("hex"),
        });
      } else if (purpose === "BARBERSHOP_LOGO") {
        // Commercial Logo: fit: 'inside' (PRESERVE complete content and alpha channel), main 512x512 (max 512 KiB), thumb 256x256 (max 200 KiB)
        const mainPipeline = sharp(buffer).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true });
        const thumbPipeline = sharp(buffer).rotate().resize(256, 256, { fit: "inside", withoutEnlargement: true });

        const preferredFormat = format === "png" ? "png" : "webp";
        const optimizedMain = await this.optimizeBufferUnderBudget(mainPipeline, 512 * 1024, preferredFormat);
        const optimizedThumb = await this.optimizeBufferUnderBudget(thumbPipeline, 200 * 1024, preferredFormat);

        const mainMeta = await sharp(optimizedMain.buffer).metadata();
        const thumbMeta = await sharp(optimizedThumb.buffer).metadata();

        variants.push({
          name: "main",
          buffer: optimizedMain.buffer,
          width: mainMeta.width ?? 512,
          height: mainMeta.height ?? 512,
          fileSize: optimizedMain.buffer.length,
          mimeType: optimizedMain.mimeType,
          format: optimizedMain.format,
          sha256: createHash("sha256").update(optimizedMain.buffer).digest("hex"),
        });

        variants.push({
          name: "thumbnail",
          buffer: optimizedThumb.buffer,
          width: thumbMeta.width ?? 256,
          height: thumbMeta.height ?? 256,
          fileSize: optimizedThumb.buffer.length,
          mimeType: optimizedThumb.mimeType,
          format: optimizedThumb.format,
          sha256: createHash("sha256").update(optimizedThumb.buffer).digest("hex"),
        });
      } else {
        // Space Photo (BARBERSHOP_GALLERY / BARBERSHOP_COVER)
        // Main: max side 1920 px (budget 1.5 MiB), Thumbnail: max side 640 px (budget 250 KiB)
        const mainPipeline = sharp(buffer)
          .rotate()
          .resize(1920, 1920, { fit: "inside", withoutEnlargement: true });

        const thumbPipeline = sharp(buffer)
          .rotate()
          .resize(640, 640, { fit: "inside", withoutEnlargement: true });

        const optimizedMain = await this.optimizeBufferUnderBudget(
          mainPipeline,
          1.5 * 1024 * 1024,
          "webp"
        );
        const optimizedThumb = await this.optimizeBufferUnderBudget(
          thumbPipeline,
          250 * 1024,
          "webp"
        );

        const mainMeta = await sharp(optimizedMain.buffer).metadata();
        const thumbMeta = await sharp(optimizedThumb.buffer).metadata();

        variants.push({
          name: "main",
          buffer: optimizedMain.buffer,
          width: mainMeta.width ?? 1920,
          height: mainMeta.height ?? 1080,
          fileSize: optimizedMain.buffer.length,
          mimeType: optimizedMain.mimeType,
          format: optimizedMain.format,
          sha256: createHash("sha256").update(optimizedMain.buffer).digest("hex"),
        });

        variants.push({
          name: "thumbnail",
          buffer: optimizedThumb.buffer,
          width: thumbMeta.width ?? 640,
          height: thumbMeta.height ?? 360,
          fileSize: optimizedThumb.buffer.length,
          mimeType: optimizedThumb.mimeType,
          format: optimizedThumb.format,
          sha256: createHash("sha256").update(optimizedThumb.buffer).digest("hex"),
        });
      }

      const mainVariant = variants.find((v) => v.name === "main")!;

      return {
        valid: true,
        format: mainVariant.format,
        mimeType: mainVariant.mimeType,
        width: mainVariant.width,
        height: mainVariant.height,
        sha256: mainVariant.sha256,
        variants,
      };
    } catch (err: any) {
      return {
        valid: false,
        format,
        mimeType: inspection.mimeType,
        width: 0,
        height: 0,
        variants: [],
        error: `Falha ao processar variantes da imagem: ${err?.message || String(err)}`,
      };
    }
  }
}
