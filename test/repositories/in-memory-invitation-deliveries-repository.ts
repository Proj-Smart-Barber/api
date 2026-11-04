import type {
  InvitationDeliveriesRepository,
  InvitationDeliveryRecord,
} from "../../src/domain/application/repositories/invitation-deliveries-repository";

export class InMemoryInvitationDeliveriesRepository
  implements InvitationDeliveriesRepository
{
  public items: InvitationDeliveryRecord[] = [];

  async create(
    delivery: InvitationDeliveryRecord,
  ): Promise<InvitationDeliveryRecord> {
    const record: InvitationDeliveryRecord = {
      ...delivery,
      createdAt: delivery.createdAt ?? new Date(),
      updatedAt: delivery.updatedAt ?? new Date(),
    };
    this.items.push(record);
    return record;
  }

  async findById(id: string): Promise<InvitationDeliveryRecord | null> {
    const item = this.items.find((i) => i.id === id);
    return item ? { ...item } : null;
  }

  async findByInvitationId(
    invitationId: string,
  ): Promise<InvitationDeliveryRecord | null> {
    const item = this.items.find((i) => i.invitationId === invitationId);
    return item ? { ...item } : null;
  }

  async lockPendingForProcessing(
    limit: number = 10,
    workerId: string = "default-worker",
    lockTimeoutMinutes: number = 5,
  ): Promise<InvitationDeliveryRecord[]> {
    const now = new Date();
    const lockThreshold = new Date(
      now.getTime() - lockTimeoutMinutes * 60 * 1000,
    );

    const eligible = this.items
      .filter((item) => {
        if (item.attempts >= item.maxAttempts) return false;
        if (item.status === "PENDING" && item.nextAttemptAt <= now) return true;
        if (
          item.status === "PROCESSING" &&
          item.lockedAt &&
          item.lockedAt < lockThreshold
        )
          return true;
        return false;
      })
      .slice(0, limit);

    for (const item of eligible) {
      item.status = "PROCESSING";
      item.lockedAt = now;
      item.lockedBy = workerId;
    }

    return eligible.map((i) => ({ ...i }));
  }

  async update(delivery: InvitationDeliveryRecord): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === delivery.id);
    if (idx >= 0) {
      this.items[idx] = {
        ...this.items[idx],
        ...delivery,
        updatedAt: new Date(),
      };
    }
  }
}
