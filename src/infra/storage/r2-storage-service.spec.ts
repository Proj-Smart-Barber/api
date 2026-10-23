import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LoopbackObjectStore } from "../../../test/helpers/loopback-object-store";
import { R2StorageService } from "./r2-storage-service";
import { PureImageProcessor } from "./pure-image-processor";

describe("Task 1: Storage Service & Image Processor", () => {
  let loopbackStore: LoopbackObjectStore;
  let storageService: R2StorageService;
  let imageProcessor: PureImageProcessor;

  // Helper to construct a minimal valid PNG buffer with specified width and height
  const createMockPng = (width = 100, height = 100): Buffer => {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR chunk: 4 bytes length (13), 4 bytes "IHDR", 13 bytes data, 4 bytes CRC
    const ihdr = Buffer.alloc(4 + 4 + 13 + 4);
    ihdr.writeUInt32BE(13, 0);
    ihdr.write("IHDR", 4, 4, "ascii");
    ihdr.writeUInt32BE(width, 8);
    ihdr.writeUInt32BE(height, 12);
    ihdr.writeUInt8(8, 16); // bit depth
    ihdr.writeUInt8(6, 17); // color type (RGBA)
    ihdr.writeUInt8(0, 18); // compression
    ihdr.writeUInt8(0, 19); // filter
    ihdr.writeUInt8(0, 20); // interlace
    ihdr.writeUInt32BE(0x12345678, 21); // dummy CRC

    // Optional dummy eXIf chunk for testing EXIF stripping
    const exifData = Buffer.from("Exif\0\0GPS_LAT_LONG_DATA_SECRET");
    const exifChunk = Buffer.alloc(12 + exifData.length);
    exifChunk.writeUInt32BE(exifData.length, 0);
    exifChunk.write("eXIf", 4, 4, "ascii");
    exifData.copy(exifChunk, 8);
    exifChunk.writeUInt32BE(0x87654321, 8 + exifData.length);

    // IEND chunk
    const iend = Buffer.alloc(12);
    iend.writeUInt32BE(0, 0);
    iend.write("IEND", 4, 4, "ascii");
    iend.writeUInt32BE(0xae426082, 8);

    return Buffer.concat([signature, ihdr, exifChunk, iend]);
  };

  // Helper to construct a minimal valid JPEG buffer with SOF0 and optional APP1 (EXIF)
  const createMockJpeg = (width = 100, height = 100, includeExif = true): Buffer => {
    const parts: Buffer[] = [Buffer.from([0xff, 0xd8])]; // SOI

    if (includeExif) {
      // APP1 marker (0xFF, 0xE1) with Exif identifier and GPS coordinates
      const exifPayload = Buffer.from("Exif\0\0GPSLatitude=23.5505;GPSLongitude=46.6333");
      const app1 = Buffer.alloc(4 + exifPayload.length);
      app1[0] = 0xff;
      app1[1] = 0xe1;
      app1.writeUInt16BE(2 + exifPayload.length, 2);
      exifPayload.copy(app1, 4);
      parts.push(app1);
    }

    // SOF0 marker (0xFF, 0xC0)
    const sof0 = Buffer.alloc(19);
    sof0[0] = 0xff;
    sof0[1] = 0xc0;
    sof0.writeUInt16BE(17, 2); // Length
    sof0.writeUInt8(8, 4); // Precision
    sof0.writeUInt16BE(height, 5); // Height
    sof0.writeUInt16BE(width, 7); // Width
    sof0.writeUInt8(3, 9); // 3 components (YCbCr)

    parts.push(sof0);
    parts.push(Buffer.from([0xff, 0xda])); // SOS
    parts.push(Buffer.from([0x00, 0x01, 0x02])); // Image data
    parts.push(Buffer.from([0xff, 0xd9])); // EOI

    return Buffer.concat(parts);
  };

  beforeAll(async () => {
    loopbackStore = new LoopbackObjectStore();
    const endpoint = await loopbackStore.start();

    storageService = new R2StorageService({
      endpoint,
      bucket: "test-bucket",
      accessKeyId: "test-key-id",
      secretAccessKey: "test-secret-key",
      publicUrl: "https://media.smartbarber.local/assets",
      region: "auto",
      forcePathStyle: true,
    });

    imageProcessor = new PureImageProcessor();
  });

  afterAll(async () => {
    await loopbackStore.stop();
  });

  describe("PureImageProcessor", () => {
    it("valida e inspeciona imagem PNG corretamente", async () => {
      const pngBuf = createMockPng(800, 600);
      const res = await imageProcessor.validateAndInspect(pngBuf);

      expect(res.valid).toBe(true);
      expect(res.format).toBe("png");
      expect(res.mimeType).toBe("image/png");
      expect(res.width).toBe(800);
      expect(res.height).toBe(600);
    });

    it("valida e inspeciona imagem JPEG corretamente", async () => {
      const jpegBuf = createMockJpeg(1200, 900);
      const res = await imageProcessor.validateAndInspect(jpegBuf);

      expect(res.valid).toBe(true);
      expect(res.format).toBe("jpeg");
      expect(res.mimeType).toBe("image/jpeg");
      expect(res.width).toBe(1200);
      expect(res.height).toBe(900);
    });

    it("rejeita arquivo com dimensões excessivas (> 4096px)", async () => {
      const largePng = createMockPng(5000, 5000);
      const res = await imageProcessor.validateAndInspect(largePng);

      expect(res.valid).toBe(false);
      expect(res.error).toContain("Dimensões excedem o limite");
    });

    it("rejeita arquivo com resolução total excessiva (> 16MP)", async () => {
      const largePixelsPng = createMockPng(4096, 4000); // 16.38MP
      const res = await imageProcessor.validateAndInspect(largePixelsPng);

      expect(res.valid).toBe(false);
      expect(res.error).toContain("Resolução total");
    });

    it("rejeita arquivos SVG e HTML disfarçados", async () => {
      const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const htmlBuf = Buffer.from("<!DOCTYPE html><html><body><h1>Fake</h1></body></html>");

      const svgRes = await imageProcessor.validateAndInspect(svgBuf);
      expect(svgRes.valid).toBe(false);
      expect(svgRes.error).toContain("Imagens vetoriais SVG e arquivos HTML são rejeitados");

      const htmlRes = await imageProcessor.validateAndInspect(htmlBuf);
      expect(htmlRes.valid).toBe(false);
      expect(htmlRes.error).toContain("Imagens vetoriais SVG e arquivos HTML são rejeitados");
    });

    it("detecta e recusa explicitamente imagens HEIC com mensagem orientativa", async () => {
      // Simula cabeçalho HEIC (ftypheic)
      const heicBuf = Buffer.from([
        0x00, 0x00, 0x00, 0x18, // size
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x68, 0x65, 0x69, 0x63, // 'heic'
        0x00, 0x00, 0x00, 0x00,
      ]);

      const res = await imageProcessor.validateAndInspect(heicBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Formato HEIC não suportado diretamente");
    });

    it("remove metadados EXIF/GPS de JPEG sem corromper a imagem", async () => {
      const jpegWithExif = createMockJpeg(200, 200, true);
      expect(jpegWithExif.toString("latin1")).toContain("GPSLatitude");

      const stripped = await imageProcessor.stripExif(jpegWithExif, "jpeg");
      expect(stripped.toString("latin1")).not.toContain("GPSLatitude");

      // Deve continuar sendo um JPEG válido com as mesmas dimensões
      const res = await imageProcessor.validateAndInspect(stripped);
      expect(res.valid).toBe(true);
      expect(res.width).toBe(200);
      expect(res.height).toBe(200);
    });

    it("remove metadados EXIF de PNG sem corromper a imagem", async () => {
      const pngWithExif = createMockPng(300, 300);
      expect(pngWithExif.toString("latin1")).toContain("eXIf");

      const stripped = await imageProcessor.stripExif(pngWithExif, "png");
      expect(stripped.toString("latin1")).not.toContain("eXIf");

      const res = await imageProcessor.validateAndInspect(stripped);
      expect(res.valid).toBe(true);
      expect(res.width).toBe(300);
      expect(res.height).toBe(300);
    });
  });

  describe("R2StorageService com Loopback Object Store", () => {
    it("gera URL assinada de upload e realiza transferência HTTP real com sucesso", async () => {
      const objectKey = "avatars/user-123/avatar.png";
      const samplePng = createMockPng(150, 150);

      const uploadIntent = await storageService.generateUploadUrl({
        objectKey,
        mimeType: "image/png",
        fileSize: samplePng.length,
      });

      expect(uploadIntent.uploadUrl).toBeDefined();
      expect(uploadIntent.publicUrl).toBe("https://media.smartbarber.local/assets/avatars/user-123/avatar.png");
      expect(uploadIntent.objectKey).toBe(objectKey);

      // Executa HTTP PUT real contra a uploadUrl gerada
      const putRes = await fetch(uploadIntent.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
          "Content-Length": samplePng.length.toString(),
        },
        body: samplePng,
      });

      expect(putRes.ok).toBe(true);

      // Inspeciona o objeto armazenado através do storageService (S3 HEAD + GET)
      const inspection = await storageService.inspectObject(objectKey);
      expect(inspection.exists).toBe(true);
      expect(inspection.size).toBe(samplePng.length);
      expect(inspection.contentType).toBe("image/png");
      expect(inspection.buffer).toBeDefined();
      expect(inspection.buffer?.length).toBe(samplePng.length);

      // Exclui o objeto e verifica que deixa de existir
      await storageService.deleteObject(objectKey);
      const afterDelete = await storageService.inspectObject(objectKey);
      expect(afterDelete.exists).toBe(false);
    });
  });
});
