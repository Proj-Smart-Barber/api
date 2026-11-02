import "dotenv/config";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../src/infra/drizzle";
import { DrizzleMediaRepository } from "../src/infra/drizzle/repositories/drizzle-media-repository";
import { DrizzleVideoJobQueue } from "../src/infra/drizzle/repositories/drizzle-video-job-queue";
import { DrizzleMediaQuota } from "../src/infra/drizzle/repositories/drizzle-media-quota";
import { getStorageService } from "../src/infra/storage/storage-service-factory";
import { processVideo } from "../src/infra/storage/video-processor";
const queue = new DrizzleVideoJobQueue();
const media = new DrizzleMediaRepository();
const storage = getStorageService();
const quota = new DrizzleMediaQuota();
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
async function authorized(ownerId: string, shopId: string) {
  const result = await db.execute(
    sql`SELECT 1 FROM membership ms JOIN barbershops b ON b.id=ms.barbershop_id WHERE ms.user_id=${ownerId}::uuid AND ms.barbershop_id=${shopId}::uuid AND ms.role='OWNER' AND ms.state='ACTIVE' AND b.status='ACTIVE'`,
  );
  return result.rows.length > 0;
}
async function once() {
  const id = await queue.claim();
  if (!id) return false;
  const leaseToken = randomUUID();
  let saved: string[] = [];
  let staging: string | undefined;
  try {
    const claim = await media.claimForProcessing(id, {
      leaseToken,
      leaseDurationMs: 300000,
    });
    if (!claim.claimed || !claim.media) {
      await queue.finish(id, false);
      return true;
    }
    const item = claim.media;
    staging = item.objectKey;
    if (
      !item.ownerEntityId ||
      !(await authorized(
        item.ownerId.toString(),
        item.ownerEntityId.toString(),
      ))
    )
      throw new Error("Vínculo owner não está ativo.");
    const original = await storage.inspectStagingObject(
      staging,
      100 * 1024 * 1024,
    );
    if (!original.exists || !original.buffer || original.truncated)
      throw new Error("Original ausente ou acima do limite.");
    const result = await processVideo(original.buffer);
    const key = `variants/${id}/${item.generation}`;
    const main = await storage.saveVariant({
      objectKey: `${key}/main.mp4`,
      buffer: result.main,
      mimeType: "video/mp4",
    });
    saved.push(main.objectKey);
    const poster = await storage.saveVariant({
      objectKey: `${key}/poster.webp`,
      buffer: result.poster,
      mimeType: "image/webp",
    });
    saved.push(poster.objectKey);
    const variants = {
      main: {
        ...main,
        width: result.width,
        height: result.height,
        fileSize: result.main.length,
        mimeType: "video/mp4",
        durationSeconds: result.duration,
      },
      thumbnail: {
        ...poster,
        width: 480,
        height: Math.max(1, Math.round((480 * result.height) / result.width)),
        fileSize: result.poster.length,
        mimeType: "image/webp",
      },
    };
    const complete = await db.execute(
      sql`UPDATE media SET status='READY',object_key=${main.objectKey},public_url=${main.publicUrl},mime_type='video/mp4',file_size=${result.main.length},width=${result.width},height=${result.height},variants=${JSON.stringify(variants)}::jsonb,lease_token=NULL,lease_expires_at=NULL,updated_at=NOW() WHERE id=${id}::uuid AND status='PROCESSING' AND lease_token=${leaseToken} AND lease_expires_at>NOW() AND EXISTS(SELECT 1 FROM membership ms JOIN barbershops b ON b.id=ms.barbershop_id WHERE ms.user_id=media.owner_id AND ms.barbershop_id=media.owner_entity_id AND ms.role='OWNER' AND ms.state='ACTIVE' AND b.status='ACTIVE') RETURNING id`,
    );
    if (!complete.rows.length)
      throw new Error("Autorização ou lease mudou durante o processamento.");
    saved = [];
    try {
      await storage.deleteStagingObject(staging);
      await quota.release(id);
    } catch {
      /* Keep reservation until cleanup succeeds. */
    }
    await queue.finish(id, true);
    console.log(JSON.stringify({ event: "video-ready", mediaId: id }));
  } catch {
    let cleaned = true;
    for (const key of saved) {
      try {
        await storage.deleteObject(key);
      } catch {
        cleaned = false;
      }
    }
    if (staging) {
      try {
        await storage.deleteStagingObject(staging);
      } catch {
        cleaned = false;
      }
    }
    await media.rejectProcessing(
      id,
      leaseToken,
      "Não foi possível processar este vídeo. Envie um arquivo válido até 60 segundos.",
    );
    if (cleaned) await quota.release(id);
    await queue.finish(id, false);
    console.log(JSON.stringify({ event: "video-failed", mediaId: id }));
  }
  return true;
}
(async () => {
  if (!storage.isConfigured()) throw new Error("Storage não configurado.");
  if (process.argv.includes("--once")) {
    await once();
    process.exit(0);
  }
  while (!stopping) {
    const worked = await once();
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  process.exit(0);
})().catch(() => {
  console.error(
    "Worker de vídeo indisponível. Verifique configuração, banco e storage.",
  );
  process.exit(1);
});
