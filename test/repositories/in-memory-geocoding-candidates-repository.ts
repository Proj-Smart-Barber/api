import type {
  GeocodingCandidatesRepository,
  GeocodingCandidatePersistence,
} from "../../src/domain/application/repositories/geocoding-candidates-repository";

export class InMemoryGeocodingCandidatesRepository
  implements GeocodingCandidatesRepository
{
  public items: GeocodingCandidatePersistence[] = [];
  public usageMap = new Map<string, number>();

  async findById(id: string): Promise<GeocodingCandidatePersistence | null> {
    const item = this.items.find(
      (candidate) => candidate.id === id && !candidate.consumedAt,
    );
    return item ?? null;
  }

  async create(
    candidate: Omit<GeocodingCandidatePersistence, "createdAt" | "consumedAt">,
  ): Promise<GeocodingCandidatePersistence> {
    const record: GeocodingCandidatePersistence = {
      ...candidate,
      consumedAt: null,
      createdAt: new Date(),
    };
    this.items.push(record);
    return record;
  }

  async consume(id: string): Promise<void> {
    const item = this.items.find((candidate) => candidate.id === id);
    if (item) {
      item.consumedAt = new Date();
    }
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const initialCount = this.items.length;
    this.items = this.items.filter(
      (c) => c.expiresAt.getTime() > now.getTime() && !c.consumedAt,
    );
    return initialCount - this.items.length;
  }

  async checkAndIncrementUsage(
    actorId: string,
    limitPerHour: number = 30,
  ): Promise<boolean> {
    const current = this.usageMap.get(actorId) ?? 0;
    if (current >= limitPerHour) {
      return false;
    }
    this.usageMap.set(actorId, current + 1);
    return true;
  }
}
