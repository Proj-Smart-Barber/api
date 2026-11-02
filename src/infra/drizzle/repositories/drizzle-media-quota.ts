import {DEFAULT_MEDIA_GLOBAL_BUDGET_BYTES,DEFAULT_MEDIA_SHOP_BUDGET_BYTES} from "../../../domain/application/services/media-quota";
import { sql } from "drizzle-orm";
import { db } from "../index";
import type { MediaQuota } from "../../../domain/application/services/media-quota";
export class DrizzleMediaQuota implements MediaQuota {
  async reserve(input: {
    mediaId: string;
    scope: string;
    bytes: number;
    stagingKey?: string;
  }) {
    const globalLimit = Number(process.env.R2_GLOBAL_BUDGET_BYTES??DEFAULT_MEDIA_GLOBAL_BUDGET_BYTES);
    const shopLimit = Number(process.env.R2_SHOP_BUDGET_BYTES??DEFAULT_MEDIA_SHOP_BUDGET_BYTES);
    if (
      !Number.isSafeInteger(globalLimit) ||
      globalLimit <= 0 ||
      !Number.isSafeInteger(shopLimit) ||
      shopLimit <= 0
    )
      throw new Error(
        "Orçamento de mídia não configurado. Upload temporariamente indisponível.",
      );
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(87392011)`);
      const usage = await tx.execute(
        sql`SELECT COALESCE(SUM(CASE WHEN status IN ('READY','CANCELLED','EXPIRED') THEN file_size+COALESCE((variants->'thumbnail'->>'fileSize')::bigint,0) ELSE 0 END),0)::text AS bytes FROM media`,
      );
      const reserved = await tx.execute(
        sql`SELECT COALESCE(SUM(bytes),0)::text AS bytes FROM media_upload_reservations`,
      );
      const local = await tx.execute(
        sql`SELECT COALESCE(SUM(file_size+COALESCE((variants->'thumbnail'->>'fileSize')::bigint,0)),0)::text AS bytes FROM media WHERE status IN ('READY','CANCELLED','EXPIRED') AND owner_entity_id=${input.scope}::uuid`,
      );
      const localReserved = await tx.execute(
        sql`SELECT COALESCE(SUM(bytes),0)::text AS bytes FROM media_upload_reservations WHERE scope=${input.scope}::uuid`,
      );
      if (
        Number(usage.rows[0].bytes) +
          Number(reserved.rows[0].bytes) +
          input.bytes >
          globalLimit * 0.9 ||
        Number(local.rows[0].bytes) +
          Number(localReserved.rows[0].bytes) +
          input.bytes >
          shopLimit * 0.9
      )
        throw new Error(
          "Limite de armazenamento atingido. Remova mídias ou solicite revisão da quota.",
        );
      await tx.execute(
        sql`INSERT INTO media_upload_reservations(media_id,scope,bytes,staging_key) VALUES(${input.mediaId}::uuid,${input.scope}::uuid,${input.bytes},${input.stagingKey ?? null})`,
      );
    });
  }
  async release(mediaId: string) {
    await db.execute(
      sql`DELETE FROM media_upload_reservations WHERE media_id=${mediaId}::uuid`,
    );
  }
}
