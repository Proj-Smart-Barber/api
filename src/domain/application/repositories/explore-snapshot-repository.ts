export interface ExploreSnapshot {
  id: string;
  filtersHash: string;
  ids: string[];
  expiresAt: number;
}
export interface ExploreSnapshotRepository {
  save(snapshot: ExploreSnapshot): Promise<void>;
  find(id: string): Promise<ExploreSnapshot | null>;
}
/** Test adapter only. Production factories inject durable storage. */
export class InMemoryExploreSnapshotRepository
  implements ExploreSnapshotRepository
{
  private entries = new Map<string, ExploreSnapshot>();
  async save(snapshot: ExploreSnapshot) {
    this.entries.set(snapshot.id, structuredClone(snapshot));
  }
  async find(id: string) {
    const value = this.entries.get(id);
    return value ? structuredClone(value) : null;
  }
}
