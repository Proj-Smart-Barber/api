import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { createHash } from "node:crypto";
import { SharpImageProcessor } from "../src/infra/storage/sharp-image-processor";
const root = resolve(
  process.argv[2] ?? "D:/smart_barber/midia-explorar/organizado-2026-11-01",
);
const source = resolve(
  process.argv[3] ??
    "D:/smart_barber/api/docs/seed-media/manifesto-10-barbearias.json",
);
const output = resolve(process.argv[4] ?? "docs/media-prepared-20261102");
(async () => {
  const manifest = JSON.parse(await readFile(source, "utf8"));
  await mkdir(output, { recursive: true });
  const processor = new SharpImageProcessor();
  const items: any[] = [];
  for (const shop of manifest.barbershops) {
    const logos = shop.logos.filter((asset: any) =>
      asset.file.endsWith(".webp"),
    );
    const chosen =
      logos.find((asset: any) => asset.variant === "light") ??
      logos.find((asset: any) => asset.variant === "original") ??
      logos[0];
    for (const asset of [chosen, ...shop.photos].filter(Boolean)) {
      const path = resolve(root, asset.file);
      if (!path.startsWith(root + sep))
        throw new Error("Asset outside media root");
      const data = await readFile(path);
      if (createHash("sha256").update(data).digest("hex") !== asset.sha256)
        throw new Error("Asset hash mismatch");
      const purpose =
        asset === chosen
          ? "BARBERSHOP_LOGO"
          : asset.kind === "servicos"
            ? "SERVICE_PHOTO"
            : "BARBERSHOP_GALLERY";
      if (asset.assetId === "USER-NEXO-003") {
        items.push({
          shopKey: shop.barbershopLogicalKey,
          assetId: asset.assetId,
          status: "EXCLUDED_UNKNOWN_SOURCE",
          original: asset.file,
        });
        continue;
      }
      const result = await processor.processImage(data, purpose);
      if (!result.valid) throw new Error(result.error ?? "Invalid media");
      const assetId =
        asset.assetId ??
        createHash("sha256").update(asset.file).digest("hex").slice(0, 12);
      const directory = join(output, shop.mediaKey, assetId);
      await mkdir(directory, { recursive: true });
      const variants = [];
      for (const variant of result.variants) {
        const file = join(directory, variant.name + "." + variant.format);
        await writeFile(file, variant.buffer);
        variants.push({
          file,
          sha256: variant.sha256,
          bytes: variant.fileSize,
          width: variant.width,
          height: variant.height,
          mimeType: variant.mimeType,
        });
      }
      items.push({
        shopKey: shop.barbershopLogicalKey,
        mediaKey: shop.mediaKey,
        assetId,
        original: asset.file,
        originalSha256: asset.sha256,
        originalBytes: data.length,
        purpose,
        context: asset.kind ?? "logo",
        category: asset.category,
        serviceLogicalKey: asset.serviceLogicalKey ?? null,
        serviceId: null,
        shopId: null,
        publicationApproved: false,
        rightsStatus: asset.rightsStatus ?? "LOGO_REVIEW_PENDING",
        status: "PREPARED_NOT_UPLOADED",
        variants,
      });
    }
  }
  const summary = {
    shops: manifest.barbershops.length,
    items: items.length,
    prepared: items.filter((item) => item.status === "PREPARED_NOT_UPLOADED")
      .length,
    excluded: items.filter((item) => item.status.startsWith("EXCLUDED")).length,
    originalBytes: items.reduce(
      (total, item) => total + (item.originalBytes ?? 0),
      0,
    ),
    preparedBytes: items.reduce(
      (total, item) =>
        total +
        (item.variants ?? []).reduce(
          (sum: number, variant: any) => sum + variant.bytes,
          0,
        ),
      0,
    ),
    uploaded: false,
  };
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(
      { version: 1, mode: "LOCAL_DERIVATIVES_ONLY", summary, items },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(summary));
})().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Media preparation failed",
  );
  process.exitCode = 1;
});
