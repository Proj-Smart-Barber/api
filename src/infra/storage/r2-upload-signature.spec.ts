import { describe, expect, it } from "vitest";
import { R2StorageService } from "./r2-storage-service";

describe("assinatura de upload direto do navegador", () => {
  const storage = new R2StorageService({
    endpoint: "https://storage.example.test",
    stagingBucket: "private-staging",
    publicBucket: "public-variants",
    publicUrl: "https://media.example.test",
    accessKeyId: "fixture-key",
    secretAccessKey: "fixture-secret",
  });

  it("não assina o checksum de um corpo vazio quando os bytes serão enviados pelo navegador", async () => {
    const signed = await storage.generateUploadUrl({
      objectKey: "staging/fixture/image.png",
      mimeType: "image/png",
      fileSize: 256,
    });
    const url = new URL(signed.uploadUrl);

    expect(url.searchParams.get("x-amz-checksum-crc32")).toBeNull();
    expect(url.searchParams.get("x-amz-sdk-checksum-algorithm")).toBeNull();
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(url.pathname).toBe("/private-staging/staging/fixture/image.png");
  });

  it("mantém partes multipart sem checksum calculado sobre um corpo ausente", async () => {
    const signed = await storage.signMultipartPart(
      "staging/fixture/video.mp4",
      "fixture-upload",
      1,
      5242880,
    );
    const url = new URL(signed);

    expect(url.searchParams.get("x-amz-checksum-crc32")).toBeNull();
    expect(url.searchParams.get("partNumber")).toBe("1");
  });
});
