import { sql } from "drizzle-orm";
import { db } from "../index";
import type { VideoJobQueue } from "../../../domain/application/services/video-job-queue";
export class DrizzleVideoJobQueue implements VideoJobQueue {
  async enqueue(mediaId: string) {
    await db.execute(
      sql`INSERT INTO media_video_jobs(media_id) VALUES(${mediaId}::uuid) ON CONFLICT(media_id) DO NOTHING`,
    );
  }
  async claim() {
    const result = await db.execute(
      sql`UPDATE media_video_jobs SET state='RUNNING',attempts=attempts+1,lease_until=NOW()+INTERVAL '10 minutes',updated_at=NOW() WHERE media_id=(SELECT media_id FROM media_video_jobs WHERE attempts<3 AND (state='PENDING' OR (state='RUNNING' AND lease_until<NOW())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING media_id`,
    );
    return result.rows[0] ? String(result.rows[0].media_id) : null;
  }
  async finish(mediaId: string, success: boolean) {
    await db.execute(
      sql`UPDATE media_video_jobs SET state=${success ? "COMPLETE" : "FAILED"},lease_until=NULL,updated_at=NOW() WHERE media_id=${mediaId}::uuid`,
    );
  }
}
