import { sql } from "drizzle-orm";
import { db } from "../index";
export class DrizzleServiceMediaRepository {
  async attach(input: {
    userId: string;
    shopId: string;
    serviceId: string;
    mediaId: string;
    displayOrder: number;
  }) {
    return db.transaction(async (tx) => {
      const eligible = await tx.execute(
        sql`SELECT CASE WHEN m.mime_type LIKE 'video/%' THEN m.variants->'thumbnail'->>'publicUrl' ELSE m.public_url END AS public_url FROM services s JOIN barbershops b ON b.id=s.barbershop_id JOIN membership ms ON ms.barbershop_id=b.id JOIN media m ON m.id=${input.mediaId}::uuid WHERE s.id=${input.serviceId}::uuid AND b.id=${input.shopId}::uuid AND b.status='ACTIVE' AND ms.user_id=${input.userId}::uuid AND ms.role='OWNER' AND ms.state='ACTIVE' AND m.owner_entity_id=b.id AND m.owner_id=ms.user_id AND m.status='READY' AND m.purpose IN ('SERVICE_PHOTO','SERVICE_VIDEO') FOR UPDATE OF s,b,ms,m`,
      );
      if (!eligible.rows.length) return null;
      const existing = await tx.execute(
        sql`SELECT media_id,display_order FROM service_media WHERE service_id=${input.serviceId}::uuid`,
      );
      if (
        existing.rows.length >= 6 &&
        !existing.rows.some((row) => String(row.media_id) === input.mediaId)
      )
        throw new Error("Limite de seis fotos por serviço atingido.");
      const current = existing.rows.find(
        (row) => String(row.media_id) === input.mediaId,
      );
      if (!current || Number(current.display_order) !== input.displayOrder)
        await tx.execute(
          sql`UPDATE service_media SET display_order=display_order+1 WHERE service_id=${input.serviceId}::uuid AND media_id<>${input.mediaId}::uuid AND display_order>=${input.displayOrder}`,
        );
      await tx.execute(
        sql`INSERT INTO service_media(service_id,media_id,display_order) VALUES(${input.serviceId}::uuid,${input.mediaId}::uuid,${input.displayOrder}) ON CONFLICT(service_id,media_id) DO UPDATE SET display_order=EXCLUDED.display_order`,
      );
      await tx.execute(
        sql`UPDATE services SET image_url=(SELECT CASE WHEN m.mime_type LIKE 'video/%' THEN m.variants->'thumbnail'->>'publicUrl' ELSE m.public_url END FROM service_media sm JOIN media m ON m.id=sm.media_id WHERE sm.service_id=${input.serviceId}::uuid AND m.status='READY' ORDER BY sm.display_order,sm.media_id LIMIT 1),updated_at=NOW() WHERE id=${input.serviceId}::uuid`,
      );
      return {
        mediaId: input.mediaId,
        publicUrl: String(eligible.rows[0].public_url),
      };
    });
  }
  async list(shopId: string, serviceId: string, userId?: string) {
    const result = await db.execute(
      sql`SELECT m.id AS "mediaId",m.public_url AS url,m.mime_type AS "mimeType",m.variants->'thumbnail'->>'publicUrl' AS "posterUrl",sm.display_order AS "displayOrder" FROM service_media sm JOIN services s ON s.id=sm.service_id JOIN barbershops b ON b.id=s.barbershop_id JOIN media m ON m.id=sm.media_id WHERE s.id=${serviceId}::uuid AND b.id=${shopId}::uuid AND b.status='ACTIVE' AND (s.is_active=true OR EXISTS(SELECT 1 FROM membership ms WHERE ms.barbershop_id=b.id AND ms.user_id=${userId ?? null}::uuid AND ms.role='OWNER' AND ms.state='ACTIVE')) AND m.status='READY' AND m.owner_entity_id=b.id ORDER BY sm.display_order,m.id`,
    );
    return result.rows;
  }
  async detach(input: {
    userId: string;
    shopId: string;
    serviceId: string;
    mediaId: string;
  }) {
    return db.transaction(async (tx) => {
      const owner = await tx.execute(
        sql`SELECT s.id FROM services s JOIN membership ms ON ms.barbershop_id=s.barbershop_id WHERE s.id=${input.serviceId}::uuid AND s.barbershop_id=${input.shopId}::uuid AND ms.user_id=${input.userId}::uuid AND ms.role='OWNER' AND ms.state='ACTIVE' FOR UPDATE OF s,ms`,
      );
      if (!owner.rows.length) return false;
      await tx.execute(
        sql`DELETE FROM service_media WHERE service_id=${input.serviceId}::uuid AND media_id=${input.mediaId}::uuid`,
      );
      await tx.execute(
        sql`UPDATE services SET image_url=(SELECT CASE WHEN m.mime_type LIKE 'video/%' THEN m.variants->'thumbnail'->>'publicUrl' ELSE m.public_url END FROM service_media sm JOIN media m ON m.id=sm.media_id WHERE sm.service_id=${input.serviceId}::uuid AND m.status='READY' ORDER BY sm.display_order,sm.media_id LIMIT 1),updated_at=NOW() WHERE id=${input.serviceId}::uuid`,
      );
      await tx.execute(
        sql`UPDATE media SET status='CANCELLED',updated_at=NOW() WHERE id=${input.mediaId}::uuid AND owner_entity_id=${input.shopId}::uuid AND NOT EXISTS(SELECT 1 FROM service_media WHERE media_id=media.id) AND NOT EXISTS(SELECT 1 FROM barbershop_gallery WHERE media_id=media.id)`,
      );
      return true;
    });
  }
}
