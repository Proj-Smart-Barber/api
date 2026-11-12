import { sql } from "drizzle-orm";
import { db } from "../index";
import type {
  ExploreSnapshot,
  ExploreSnapshotRepository,
} from "../../../domain/application/repositories/explore-snapshot-repository";
export class DrizzleExploreSnapshotRepository
  implements ExploreSnapshotRepository
{
  async save(snapshot: ExploreSnapshot): Promise<void> {
    await db.execute(
      sql`INSERT INTO explore_feed_snapshots (id, filters_hash, ordered_ids, expires_at) VALUES (${snapshot.id}::uuid, ${snapshot.filtersHash}, ${JSON.stringify(snapshot.ids)}::jsonb, ${new Date(snapshot.expiresAt).toISOString()}::timestamptz) ON CONFLICT (id) DO UPDATE SET filters_hash = EXCLUDED.filters_hash, ordered_ids = EXCLUDED.ordered_ids, expires_at = EXCLUDED.expires_at`,
    );
  }
  async deleteExpired(batchLimit = 500): Promise<number> {
    const result = await db.execute(
      sql`DELETE FROM explore_feed_snapshots WHERE id IN (SELECT id FROM explore_feed_snapshots WHERE expires_at < NOW() LIMIT ${batchLimit})`,
    );
    return Number((result as any).rowCount ?? 0);
  }
  async find(id: string): Promise<ExploreSnapshot | null> {
    const result = await db.execute(
      sql`SELECT id, filters_hash, ordered_ids, expires_at FROM explore_feed_snapshots WHERE id=${id}::uuid AND expires_at > NOW()`,
    );
    const row = result.rows[0];
    return row
      ? {
          id: String(row.id),
          filtersHash: String(row.filters_hash),
          ids: row.ordered_ids as string[],
          expiresAt: new Date(String(row.expires_at)).getTime(),
        }
      : null;
  }
}
