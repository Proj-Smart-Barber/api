import {abortMediaMultipart} from "../../../storage/multipart-cleanup";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../drizzle";
import type { Controller } from "../../../../core/infra/controller";
import type { HttpResponse } from "../../../../core/infra/http-response";
export class CancelMediaUploadController implements Controller {
  async handle(request: unknown): Promise<HttpResponse> {
    const parsed = z
      .object({ userId: z.string().uuid(), mediaId: z.string().uuid() })
      .safeParse(request);
    if (!parsed.success)
      return { statusCode: 400, body: { error: "IDs inválidos." } };
    const result = await db.execute(
      sql`UPDATE media SET status='CANCELLED',lease_token=NULL,lease_expires_at=NULL,updated_at=NOW() WHERE id=${parsed.data.mediaId}::uuid AND owner_id=${parsed.data.userId}::uuid AND (owner_type='USER' OR EXISTS(SELECT 1 FROM membership ms WHERE ms.user_id=media.owner_id AND ms.barbershop_id=media.owner_entity_id AND ms.role='OWNER' AND ms.state='ACTIVE')) AND NOT EXISTS(SELECT 1 FROM service_media WHERE media_id=media.id) AND NOT EXISTS(SELECT 1 FROM barbershop_gallery WHERE media_id=media.id) AND NOT EXISTS(SELECT 1 FROM barbershops WHERE avatar_url=media.public_url) AND NOT EXISTS(SELECT 1 FROM users WHERE avatar_url=media.public_url) RETURNING id`,
    );
    if(result.rows.length){try{await abortMediaMultipart(parsed.data.mediaId);}catch{return {statusCode:202,body:{success:true,cleanupPending:true}};}}
    return {
      statusCode: result.rows.length ? 200 : 409,
      body: { success: result.rows.length > 0 },
    };
  }
}
