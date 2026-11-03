/** Privileged, local maintenance command. Never expose this runner as an HTTP route. */
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  realpath,
  open,
} from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import { z } from "zod";

const argument = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const digest = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
const itemSchema = z.object({
  assetId: z.string().min(1),
  decision: z.enum(["import", "reserve", "excluded"]),
  shopKey: z.string().optional(),
  purpose: z
    .enum(["BARBERSHOP_LOGO", "BARBERSHOP_GALLERY", "SERVICE_PHOTO"])
    .optional(),
  serviceKey: z.string().nullable().optional(),
  file: z.string().optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  bytes: z.number().int().positive().optional(),
  context: z.string().nullable().optional(),
});
const manifestSchema = z.object({
  version: z.literal(1),
  namespace: z.literal("demo-smart-barber-v1"),
  items: z.array(itemSchema),
});
type Entry = z.infer<typeof itemSchema>;
const shops = new Set(
  [
    "horizonte",
    "estacao",
    "norte",
    "sul",
    "oeste",
    "aurora",
    "vertice",
    "raiz",
    "orbita",
    "nexo",
  ].map((k) => `${k}:barbershop`),
);
class GuardError extends Error {}
let phase = "preflight";

async function main() {
  const envFile = argument("env-file");
  if (!envFile || !argument("expected-host") || !argument("expected-database"))
    throw new GuardError("Explicit environment and target required");
  config({ path: resolve(envFile), override: true, quiet: true });
  const target = new URL(process.env.DATABASE_URL!);
  if (
    target.hostname !== argument("expected-host") ||
    decodeURIComponent(target.pathname.slice(1)) !==
      argument("expected-database")
  )
    throw new GuardError("Target mismatch");
  const apply = process.argv.includes("--apply");
  if (apply && argument("confirm") !== "IMPORTAR_MIDIAS_DEMO")
    throw new GuardError("Apply confirmation required");
  if (apply && !argument("backup"))
    throw new GuardError("Verified database backup required");
  if (apply) {
    const backup = await open(resolve(argument("backup")!), "r");
    try {
      const magic = Buffer.alloc(5);
      await backup.read(magic, 0, 5, 0);
      if (magic.toString() !== "PGDMP")
        throw new GuardError("PostgreSQL custom archive required");
    } finally {
      await backup.close();
    }
  }
  let approvedHashes = new Set<string>();
  if (argument("approval-file")) {
    const approval = JSON.parse(
      await readFile(resolve(argument("approval-file")!), "utf8"),
    );
    approvedHashes = new Set(
      z
        .array(z.string().regex(/^[a-f0-9]{64}$/))
        .parse(approval.approvedSha256),
    );
  }
  const root = await realpath(resolve("assets/demo-media"));
  const raw = await readFile(resolve(root, "manifest.json"));
  const manifest = manifestSchema.parse(JSON.parse(raw.toString()));
  const selected = manifest.items.filter((i) => i.decision === "import");
  if (!selected.length || selected.length > 110)
    throw new GuardError("Invalid batch size");
  const items = new Map<Entry, Buffer>();
  const identifiers = new Set<string>();
  // Validate the entire batch before any remote write, including portable paths and source hashes.
  for (const item of selected) {
    if (
      !item.shopKey ||
      !shops.has(item.shopKey) ||
      !item.file ||
      !item.sha256 ||
      !item.purpose
    )
      throw new GuardError("Invalid item scope");
    if (
      item.purpose === "SERVICE_PHOTO" &&
      (!item.serviceKey ||
        item.serviceKey.split(":")[0] !== item.shopKey.split(":")[0])
    )
      throw new GuardError("Missing service association");
    const identity = `${item.shopKey}:${item.purpose}:${item.serviceKey ?? ""}:${item.sha256}`;
    if (identifiers.has(identity))
      throw new GuardError("Duplicate import identity");
    identifiers.add(identity);
    const path = await realpath(resolve(root, item.file));
    if (!path.startsWith(root + sep))
      throw new GuardError("Asset outside package");
    const data = await readFile(path);
    if (digest(data) !== item.sha256 || data.length !== item.bytes)
      throw new GuardError("Source integrity mismatch");
    if (apply && !approvedHashes.has(item.sha256))
      throw new GuardError("Editorial approval missing");
    items.set(item, data);
  }
  const { isStorageConfigured, getStorageService } = await import(
    "../src/infra/storage/storage-service-factory.js"
  );
  if (!isStorageConfigured())
    throw new GuardError("Storage configuration incomplete");
  const publicOrigin = new URL(process.env.STORAGE_PUBLIC_URL!);
  const storageOrigin = new URL(process.env.STORAGE_ENDPOINT!);
  if (
    publicOrigin.protocol !== "https:" ||
    storageOrigin.protocol !== "https:" ||
    !storageOrigin.hostname.endsWith(".r2.cloudflarestorage.com")
  )
    throw new GuardError("Unexpected storage origin");
  // Existing image processor remains the authoritative decoder during confirmation.
  const { makeInitiateMediaUploadController } = await import(
    "../src/infra/http/factories/make-initiate-media-upload-controller.js"
  );
  const { makeConfirmMediaUploadController } = await import(
    "../src/infra/http/factories/make-confirm-media-upload-controller.js"
  );
  const { makeAddBarbershopGalleryPhotoController } = await import(
    "../src/infra/http/factories/make-barbershop-gallery-controllers.js"
  );
  const { makeUpdateBarbershopLogoController } = await import(
    "../src/infra/http/factories/make-update-barbershop-logo-controller.js"
  );
  const { AttachServiceMediaController } = await import(
    "../src/infra/http/controllers/service/attach-service-media.controller.js"
  );
  const sharp = (await import("sharp")).default;
  for (const data of items.values()) {
    const metadata = await sharp(data, {
      limitInputPixels: 40_000_000,
    }).metadata();
    if (
      metadata.format !== "webp" ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages && metadata.pages > 1)
    )
      throw new GuardError("Unsupported image");
  }
  const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const probe = new S3Client({
    region: process.env.STORAGE_REGION ?? "auto",
    endpoint: storageOrigin.origin,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
    },
  });
  for (const Bucket of [
    process.env.STORAGE_STAGING_BUCKET ?? process.env.STORAGE_BUCKET,
    process.env.STORAGE_PUBLIC_BUCKET ?? process.env.STORAGE_BUCKET,
  ])
    await probe.send(new ListObjectsV2Command({ Bucket, MaxKeys: 1 }));
  probe.destroy();
  const client = new Client({
    connectionString: target.toString(),
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  const folder = resolve(
    argument("output") ?? ".media-import",
    digest(`${target.hostname}/${target.pathname}`).slice(0, 16),
  );
  await mkdir(folder, { recursive: true });
  const journalPath = resolve(folder, "journal.json");
  let journal: Record<
    string,
    { mediaId: string; previousLogo?: string | null; state: string }
  > = {};
  try {
    journal = JSON.parse(await readFile(journalPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const save = async () => {
    await writeFile(journalPath + ".tmp", JSON.stringify(journal, null, 2));
    await rename(journalPath + ".tmp", journalPath);
  };
  const checked = async (
    controller: { handle(request: any): Promise<any> },
    request: object,
  ) => {
    const result = await controller.handle(request);
    if (result.statusCode < 200 || result.statusCode >= 300)
      throw new GuardError("Application operation rejected");
    return result.body;
  };
  const report = {
    mode: apply ? "apply" : "dry-run",
    database: argument("expected-database"),
    manifestSha256: digest(raw),
    selected: selected.length,
    reserve: manifest.items.filter((i) => i.decision === "reserve").length,
    excluded: manifest.items.filter((i) => i.decision === "excluded").length,
    sourceBytes: [...items.values()].reduce((n, b) => n + b.length, 0),
    imported: 0,
    reused: 0,
    plannedNew: 0,
  };
  try {
    await client.query("SELECT pg_advisory_lock(87392012)");
    const registry = await client.query(
      "SELECT logical_key,table_name,record_id FROM demo_seed_registry WHERE namespace=$1",
      [manifest.namespace],
    );
    const lookup = (key: string, table: string) => {
      const row = registry.rows.find(
        (r) => r.logical_key === key && r.table_name === table,
      );
      if (!row) throw new GuardError("Missing seeded target");
      return row.record_id as string;
    };
    const targets = new Map<
      Entry,
      { shopId: string; ownerId: string; serviceId?: string }
    >();
    for (const item of selected) {
      const shopId = lookup(item.shopKey!, "barbershops");
      const result = await client.query(
        "SELECT b.owner_id,b.avatar_url FROM barbershops b JOIN membership m ON m.barbershop_id=b.id AND m.user_id=b.owner_id WHERE b.id=$1 AND b.status='ACTIVE' AND m.role='OWNER' AND m.state='ACTIVE'",
        [shopId],
      );
      if (result.rows.length !== 1) throw new GuardError("Owner scope invalid");
      const serviceId = item.serviceKey
        ? lookup(item.serviceKey, "services")
        : undefined;
      if (
        serviceId &&
        !(
          await client.query(
            "SELECT 1 FROM services WHERE id=$1 AND barbershop_id=$2 AND is_active=true",
            [serviceId, shopId],
          )
        ).rowCount
      )
        throw new GuardError("Service scope invalid");
      targets.set(item, {
        shopId,
        ownerId: result.rows[0].owner_id,
        serviceId,
      });
      const importKey =
        "media:" +
        digest(
          `${item.shopKey}|${item.serviceKey ?? ""}|${item.purpose}|${item.sha256}`,
        );
      const prior = await client.query(
        "SELECT record_id FROM demo_seed_registry WHERE namespace='demo-media-import-v1' AND logical_key=$1 AND table_name='media'",
        [importKey],
      );
      if (prior.rows.length)
        journal[importKey] = {
          ...journal[importKey],
          mediaId: prior.rows[0].record_id,
          state: journal[importKey]?.state ?? "RECOVERED",
        };
      if (
        item.purpose === "BARBERSHOP_LOGO" &&
        result.rows[0].avatar_url &&
        !journal[importKey] &&
        !process.argv.includes("--replace-logos")
      )
        throw new GuardError(
          "Existing logo protected; review before explicit replacement",
        );
    }
    report.plannedNew = selected.filter(
      (i) =>
        !journal[
          "media:" +
            digest(
              `${i.shopKey}|${i.serviceKey ?? ""}|${i.purpose}|${i.sha256}`,
            )
        ],
    ).length;
    for (const serviceId of new Set(
      [...targets.values()].map((t) => t.serviceId).filter(Boolean),
    )) {
      const existing = await client.query(
        "SELECT media_id FROM service_media WHERE service_id=$1",
        [serviceId],
      );
      const additional = selected
        .filter((i) => targets.get(i)!.serviceId === serviceId)
        .filter((i) => {
          const id =
            journal[
              "media:" +
                digest(
                  `${i.shopKey}|${i.serviceKey ?? ""}|${i.purpose}|${i.sha256}`,
                )
            ]?.mediaId;
          return !existing.rows.some((r) => r.media_id === id);
        }).length;
      if (existing.rows.length + additional > 6)
        throw new GuardError("Service capacity exceeded");
    }
    const {
      DEFAULT_MEDIA_GLOBAL_BUDGET_BYTES,
      DEFAULT_MEDIA_SHOP_BUDGET_BYTES,
      uploadReservationBytes,
    } = await import("../src/domain/application/services/media-quota.js");
    const usage = await client.query(
      "SELECT COALESCE(SUM(file_size+COALESCE((variants->'thumbnail'->>'fileSize')::bigint,0)),0)::text bytes FROM media WHERE status IN ('READY','CANCELLED','EXPIRED')",
    );
    const reserved = await client.query(
      "SELECT COALESCE(SUM(bytes),0)::text bytes FROM media_upload_reservations",
    );
    const projected = selected.reduce(
      (sum, item) =>
        sum + uploadReservationBytes(items.get(item)!.length, false),
      0,
    );
    if (
      Number(usage.rows[0].bytes) + Number(reserved.rows[0].bytes) + projected >
      Number(
        process.env.R2_GLOBAL_BUDGET_BYTES ?? DEFAULT_MEDIA_GLOBAL_BUDGET_BYTES,
      ) *
        0.9
    )
      throw new GuardError("Batch exceeds global budget");
    for (const shopId of new Set([...targets.values()].map((t) => t.shopId))) {
      const scope = selected.filter((i) => targets.get(i)!.shopId === shopId);
      const local = await client.query(
        "SELECT COALESCE(SUM(file_size+COALESCE((variants->'thumbnail'->>'fileSize')::bigint,0)),0)::text bytes FROM media WHERE owner_entity_id=$1 AND status IN ('READY','CANCELLED','EXPIRED')",
        [shopId],
      );
      const pending = await client.query(
        "SELECT COALESCE(SUM(bytes),0)::text bytes FROM media_upload_reservations WHERE scope=$1",
        [shopId],
      );
      if (
        Number(local.rows[0].bytes) +
          Number(pending.rows[0].bytes) +
          scope.reduce(
            (sum, i) =>
              sum + uploadReservationBytes(items.get(i)!.length, false),
            0,
          ) >
        Number(
          process.env.R2_SHOP_BUDGET_BYTES ?? DEFAULT_MEDIA_SHOP_BUDGET_BYTES,
        ) *
          0.9
      )
        throw new GuardError("Batch exceeds shop budget");
      const existingGallery = await client.query(
        "SELECT media_id FROM barbershop_gallery WHERE barbershop_id=$1",
        [shopId],
      );
      const additional = scope
        .filter((i) => i.purpose === "BARBERSHOP_GALLERY")
        .filter((i) => {
          const id =
            journal[
              "media:" +
                digest(
                  `${i.shopKey}|${i.serviceKey ?? ""}|${i.purpose}|${i.sha256}`,
                )
            ]?.mediaId;
          return !existingGallery.rows.some((r) => r.media_id === id);
        }).length;
      if (existingGallery.rows.length + additional > 10)
        throw new GuardError("Gallery capacity exceeded");
    }
    if (!apply) {
      await writeFile(
        resolve(folder, "dry-run.json"),
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report));
      return;
    }
    const storage = getStorageService();
    for (const item of selected) {
      phase = item.assetId;
      const targetScope = targets.get(item)!;
      const key =
        "media:" +
        digest(
          `${item.shopKey}|${item.serviceKey ?? ""}|${item.purpose}|${item.sha256}`,
        );
      const data = items.get(item)!;
      if (!journal[key]) {
        const intent = await checked(makeInitiateMediaUploadController(), {
          userId: targetScope.ownerId,
          barbershopId: targetScope.shopId,
          purpose: item.purpose,
          fileName: item.assetId + ".webp",
          contentType: "image/webp",
          fileSize: data.length,
        });
        journal[key] = { mediaId: intent.mediaId, state: "PENDING" };
        await save();
      }
      const entry = journal[key];
      await client.query(
        "INSERT INTO demo_seed_registry(namespace,logical_key,table_name,record_id) VALUES('demo-media-import-v1',$1,'media',$2) ON CONFLICT(namespace,logical_key) DO NOTHING",
        [key, entry.mediaId],
      );
      const row = (
        await client.query(
          "SELECT * FROM media WHERE id=$1 AND owner_id=$2 AND owner_entity_id=$3 AND purpose=$4",
          [
            entry.mediaId,
            targetScope.ownerId,
            targetScope.shopId,
            item.purpose,
          ],
        )
      ).rows[0];
      if (!row) throw new GuardError("Imported media identity mismatch");
      if (row.status === "PENDING") {
        const destination = await storage.generateUploadUrl({
          objectKey: row.object_key,
          mimeType: "image/webp",
          fileSize: data.length,
        });
        const url = new URL(destination.uploadUrl);
        if (url.origin !== storageOrigin.origin)
          throw new GuardError("Unexpected upload destination");
        const uploaded = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: new Uint8Array(data),
          signal: AbortSignal.timeout(60000),
        });
        if (!uploaded.ok) throw new GuardError("Storage upload rejected");
      }
      const ready = await checked(makeConfirmMediaUploadController(), {
        userId: targetScope.ownerId,
        mediaId: entry.mediaId,
      });
      if (ready.media.status !== "READY")
        throw new GuardError("Media not ready");
      if (item.purpose === "BARBERSHOP_LOGO") {
        const currentLogo = (
          await client.query("SELECT avatar_url FROM barbershops WHERE id=$1", [
            targetScope.shopId,
          ])
        ).rows[0].avatar_url;
        if (
          currentLogo &&
          currentLogo !== ready.media.publicUrl &&
          !process.argv.includes("--replace-logos")
        )
          throw new GuardError("Existing logo protected");
      }
      const request = {
        userId: targetScope.ownerId,
        shopId: targetScope.shopId,
        serviceId: targetScope.serviceId,
        mediaId: entry.mediaId,
        displayOrder: 0,
      };
      let associated = false;
      if (item.purpose === "SERVICE_PHOTO") {
        associated = Boolean(
          (
            await client.query(
              "SELECT 1 FROM service_media WHERE service_id=$1 AND media_id=$2",
              [targetScope.serviceId, entry.mediaId],
            )
          ).rowCount,
        );
        if (!associated)
          await checked(new AttachServiceMediaController(), request);
      } else if (item.purpose === "BARBERSHOP_GALLERY") {
        associated = Boolean(
          (
            await client.query(
              "SELECT 1 FROM barbershop_gallery WHERE barbershop_id=$1 AND media_id=$2",
              [targetScope.shopId, entry.mediaId],
            )
          ).rowCount,
        );
        if (!associated)
          await checked(makeAddBarbershopGalleryPhotoController(), {
            ...request,
            isCover: false,
            caption:
              item.context === "portfolio-ilustrativo"
                ? "Portfólio ilustrativo de atendimentos; sem associação a serviço específico"
                : item.context === "equipe-ilustrativa"
                  ? "Pessoas ilustrativas de banco de imagens"
                  : "Ambiente ilustrativo",
          });
      } else {
        const shop = (
          await client.query("SELECT avatar_url FROM barbershops WHERE id=$1", [
            targetScope.shopId,
          ])
        ).rows[0];
        associated = shop.avatar_url === ready.media.publicUrl;
        if (!associated) {
          entry.previousLogo = shop.avatar_url;
          await save();
          await checked(makeUpdateBarbershopLogoController(), request);
        }
      }
      const remote = await storage.inspectObject(
        (
          await client.query("SELECT object_key FROM media WHERE id=$1", [
            entry.mediaId,
          ])
        ).rows[0].object_key,
      );
      if (!remote.exists || !remote.buffer?.length)
        throw new GuardError("Published object missing");
      const saved = (
        await client.query("SELECT variants FROM media WHERE id=$1", [
          entry.mediaId,
        ])
      ).rows[0];
      if (!saved.variants?.thumbnail) throw new GuardError("Thumbnail missing");
      const thumbnail = await storage.inspectObject(
        saved.variants.thumbnail.objectKey,
      );
      if (
        !thumbnail.exists ||
        thumbnail.size !== saved.variants.thumbnail.fileSize
      )
        throw new GuardError("Thumbnail integrity mismatch");
      if (
        new URL(saved.variants.thumbnail.publicUrl).origin !==
          publicOrigin.origin ||
        new URL(ready.media.publicUrl).origin !== publicOrigin.origin
      )
        throw new GuardError("Unexpected public media origin");
      const thumbnailCheck = await fetch(saved.variants.thumbnail.publicUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(15000),
      });
      if (!thumbnailCheck.ok)
        throw new GuardError("Public thumbnail unavailable");
      const publicCheck = await fetch(ready.media.publicUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(15000),
      });
      if (!publicCheck.ok) throw new GuardError("Public media unavailable");
      entry.state = "ASSOCIATED";
      await save();
      if (associated) report.reused++;
      else report.imported++;
      await writeFile(
        resolve(folder, "apply.json"),
        JSON.stringify(report, null, 2),
      );
      console.log(
        JSON.stringify({
          asset: item.assetId,
          ready: true,
          reused: associated,
        }),
      );
    }
    console.log(JSON.stringify(report));
  } finally {
    await client.query("SELECT pg_advisory_unlock(87392012)");
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      JSON.stringify({
        reason:
          error instanceof GuardError
            ? error.message
            : "Provider or application error (details suppressed)",
        error:
          "Importacao interrompida. Consulte o journal privado; nao apague registros nem execute seed para retomar.",
        phase,
      }),
    );
    process.exit(1);
  });
