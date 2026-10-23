import { createHash } from "node:crypto";
import type {
  AllowedImageFormat,
  ImageInspectionResult,
  ImageProcessorService,
  ImageVariant,
  ProcessImageResult,
} from "../../domain/application/services/image-processor-service";
import type { MediaPurpose } from "../../domain/enterprise/entities/media";

export class PureImageProcessor implements ImageProcessorService {
  private readonly MAX_DIMENSION = 4096;
  private readonly MAX_PIXELS = 16_000_000;

  async validateAndInspect(buffer: Buffer): Promise<ImageInspectionResult> {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: "Arquivo vazio ou inválido." };
    }

    // Detect and explicitly reject HEIC
    if (this.isHeic(buffer)) {
      return {
        valid: false,
        error: "Formato HEIC não suportado diretamente. Por favor, converta para JPEG, PNG ou WebP antes do envio.",
      };
    }

    // Detect and reject SVG or HTML
    if (this.isSvgOrHtml(buffer)) {
      return {
        valid: false,
        error: "Formato não permitido. Imagens vetoriais SVG e arquivos HTML são rejeitados.",
      };
    }

    // PNG Check
    if (this.isPng(buffer)) {
      const dimensions = this.getPngDimensions(buffer);
      if (!dimensions) {
        return { valid: false, error: "Arquivo PNG corrompido ou truncado." };
      }
      return this.validateDimensions("png", "image/png", dimensions.width, dimensions.height);
    }

    // JPEG Check
    if (this.isJpeg(buffer)) {
      const dimensions = this.getJpegDimensions(buffer);
      if (!dimensions) {
        return { valid: false, error: "Arquivo JPEG corrompido ou truncado." };
      }
      return this.validateDimensions("jpeg", "image/jpeg", dimensions.width, dimensions.height);
    }

    // WebP Check
    if (this.isWebp(buffer)) {
      const dimensions = this.getWebpDimensions(buffer);
      if (!dimensions) {
        return { valid: false, error: "Arquivo WebP corrompido ou truncado." };
      }
      return this.validateDimensions("webp", "image/webp", dimensions.width, dimensions.height);
    }

    return {
      valid: false,
      error: "Formato de imagem não suportado. Apenas JPEG, PNG e WebP são aceitos.",
    };
  }

  async stripExif(buffer: Buffer, format: AllowedImageFormat): Promise<Buffer> {
    if (format === "jpeg") {
      return this.stripJpegExif(buffer);
    }
    if (format === "png") {
      return this.stripPngExif(buffer);
    }
    if (format === "webp") {
      return this.stripWebpExif(buffer);
    }
    return buffer;
  }

  private validateDimensions(
    format: AllowedImageFormat,
    mimeType: string,
    width: number,
    height: number
  ): ImageInspectionResult {
    if (width <= 0 || height <= 0) {
      return { valid: false, error: "Dimensões de imagem inválidas." };
    }
    if (width > this.MAX_DIMENSION || height > this.MAX_DIMENSION) {
      return {
        valid: false,
        error: `Dimensões excedem o limite de ${this.MAX_DIMENSION}x${this.MAX_DIMENSION} pixels (encontrado ${width}x${height}).`,
      };
    }
    const totalPixels = width * height;
    if (totalPixels > this.MAX_PIXELS) {
      return {
        valid: false,
        error: `Resolução total (${totalPixels} pixels) excede o limite máximo permitido de 16 megapixels.`,
      };
    }
    return {
      valid: true,
      format,
      mimeType,
      width,
      height,
    };
  }

  private isPng(buf: Buffer): boolean {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }

  private getPngDimensions(buf: Buffer): { width: number; height: number } | null {
    // A valid PNG must contain at least 8-byte signature, 25-byte IHDR and 12-byte IEND (45 bytes)
    if (buf.length < 45) return null;
    if (!buf.includes(Buffer.from("IHDR")) || !buf.includes(Buffer.from("IEND"))) {
      return null;
    }
    const ihdrIndex = buf.indexOf(Buffer.from("IHDR"));
    if (ihdrIndex === -1 || ihdrIndex + 12 > buf.length) return null;
    const width = buf.readUInt32BE(ihdrIndex + 4);
    const height = buf.readUInt32BE(ihdrIndex + 8);
    if (width === 0 || height === 0) return null;
    return { width, height };
  }

  private stripPngExif(buf: Buffer): Buffer {
    if (!this.isPng(buf)) return buf;
    const chunks: Buffer[] = [buf.subarray(0, 8)]; // Signature
    let offset = 8;
    while (offset < buf.length) {
      if (offset + 8 > buf.length) break;
      const length = buf.readUInt32BE(offset);
      const chunkType = buf.toString("ascii", offset + 4, offset + 8);
      const totalChunkLength = 12 + length; // length (4) + type (4) + data (length) + crc (4)
      if (offset + totalChunkLength > buf.length) break;

      // Drop eXIf chunk (PNG EXIF metadata)
      if (chunkType !== "eXIf") {
        chunks.push(buf.subarray(offset, offset + totalChunkLength));
      }
      offset += totalChunkLength;
    }
    return Buffer.concat(chunks);
  }

  private isJpeg(buf: Buffer): boolean {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }

  private getJpegDimensions(buf: Buffer): { width: number; height: number } | null {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      // Standalone markers without length
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      // Start of scan
      if (marker === 0xda) {
        break;
      }
      if (offset + 4 > buf.length) return null;
      const length = buf.readUInt16BE(offset + 2);
      // SOF markers: SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf
      ) {
        if (offset + 9 > buf.length) return null;
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height };
      }
      offset += 2 + length;
    }
    return null;
  }

  private stripJpegExif(buf: Buffer): Buffer {
    if (!this.isJpeg(buf)) return buf;
    const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 0xda) {
        // SOS marker: append rest of image verbatim
        parts.push(buf.subarray(offset));
        break;
      }
      if (marker === 0xd9) {
        // EOI
        parts.push(Buffer.from([0xff, 0xd9]));
        break;
      }
      if (offset + 4 > buf.length) {
        parts.push(buf.subarray(offset));
        break;
      }
      const length = buf.readUInt16BE(offset + 2);
      const segmentTotal = 2 + length;

      // Marker 0xE1 is APP1 (EXIF, GPS, XMP)
      if (marker === 0xe1) {
        // Skip APP1 segment entirely
        offset += segmentTotal;
        continue;
      }

      parts.push(buf.subarray(offset, offset + segmentTotal));
      offset += segmentTotal;
    }
    return Buffer.concat(parts);
  }

  private isWebp(buf: Buffer): boolean {
    return (
      buf.length >= 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    );
  }

  private getWebpDimensions(buf: Buffer): { width: number; height: number } | null {
    if (buf.length < 30) return null;
    const type = buf.toString("ascii", 12, 16);
    if (type === "VP8 ") {
      // Lossy format
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
    if (type === "VP8L") {
      // Lossless format
      const b1 = buf[21];
      const b2 = buf[22];
      const b3 = buf[23];
      const b4 = buf[24];
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      return { width, height };
    }
    if (type === "VP8X") {
      // Extended format
      const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width, height };
    }
    return null;
  }

  private stripWebpExif(buf: Buffer): Buffer {
    if (!this.isWebp(buf)) return buf;
    // For standard WebP with chunks:
    let offset = 12;
    const chunks: Buffer[] = [buf.subarray(0, 12)];
    let hasVp8x = false;

    while (offset < buf.length) {
      if (offset + 8 > buf.length) break;
      const fourcc = buf.toString("ascii", offset, offset + 4);
      const chunkSize = buf.readUInt32LE(offset + 4);
      const paddedSize = chunkSize + (chunkSize % 2);
      const totalSize = 8 + paddedSize;

      if (fourcc === "EXIF") {
        // Drop EXIF chunk
        offset += totalSize;
        continue;
      }

      if (fourcc === "VP8X") {
        hasVp8x = true;
        // Copy chunk but clear EXIF flag (bit 3 of byte 8 in chunk data = byte offset + 8)
        const chunkBuf = Buffer.from(buf.subarray(offset, offset + totalSize));
        if (chunkBuf.length >= 9) {
          chunkBuf[8] = chunkBuf[8] & ~0x08; // Clear EXIF flag
        }
        chunks.push(chunkBuf);
      } else {
        chunks.push(buf.subarray(offset, offset + totalSize));
      }
      offset += totalSize;
    }

    const newBody = Buffer.concat(chunks);
    // Update RIFF payload length (file size - 8)
    newBody.writeUInt32LE(newBody.length - 8, 4);
    return newBody;
  }

  private isHeic(buf: Buffer): boolean {
    if (buf.length < 12) return false;
    const brand = buf.toString("ascii", 4, 12);
    return (
      brand.includes("ftypheic") ||
      brand.includes("ftypmif1") ||
      brand.includes("ftypmsf1") ||
      brand.includes("ftypheix") ||
      brand.includes("ftypheim")
    );
  }

  private isSvgOrHtml(buf: Buffer): boolean {
    const textSample = buf.subarray(0, Math.min(buf.length, 1024)).toString("utf-8").toLowerCase();
    return (
      textSample.includes("<svg") ||
      textSample.includes("<?xml") ||
      textSample.includes("<!doctype html") ||
      textSample.includes("<html") ||
      textSample.includes("<body") ||
      textSample.includes("<script")
    );
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
        error: inspection.error ?? "Arquivo de imagem inválido.",
      };
    }

    const stripped = await this.stripExif(buffer, inspection.format);
    const mainHash = createHash("sha256").update(stripped).digest("hex");

    const mainVariant: ImageVariant = {
      name: "main",
      buffer: stripped,
      width: Math.min(inspection.width, 1920),
      height: Math.min(inspection.height, 1080),
      fileSize: stripped.length,
      mimeType: inspection.mimeType ?? "image/jpeg",
      format: inspection.format,
      sha256: mainHash,
    };

    const thumbVariant: ImageVariant = {
      name: "thumbnail",
      buffer: stripped,
      width: Math.min(inspection.width, 256),
      height: Math.min(inspection.height, 256),
      fileSize: stripped.length,
      mimeType: inspection.mimeType ?? "image/jpeg",
      format: inspection.format,
      sha256: mainHash,
    };

    return {
      valid: true,
      format: inspection.format,
      mimeType: inspection.mimeType ?? "image/jpeg",
      width: mainVariant.width,
      height: mainVariant.height,
      sha256: mainHash,
      variants: [mainVariant, thumbVariant],
    };
  }
}
