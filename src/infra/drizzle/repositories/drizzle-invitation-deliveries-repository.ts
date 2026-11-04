import { and, asc, eq, inArray, lt, lte, or } from "drizzle-orm";
import type {
  InvitationDeliveriesRepository,
  InvitationDeliveryRecord,
} from "../../../domain/application/repositories/invitation-deliveries-repository";
import { db } from "../index";
import { invitationDeliveries } from "../schema";

export class DrizzleInvitationDeliveriesRepository
  implements InvitationDeliveriesRepository
{
  async create(
    delivery: InvitationDeliveryRecord,
    tx?: any,
  ): Promise<InvitationDeliveryRecord> {
    const executor = tx ?? db;
    const [row] = await executor
      .insert(invitationDeliveries)
      .values({
        id: delivery.id,
        invitationId: delivery.invitationId,
        barbershopId: delivery.barbershopId,
        recipientEmail: delivery.recipientEmail,
        recipientName: delivery.recipientName,
        barbershopName: delivery.barbershopName,
        ownerName: delivery.ownerName,
        tokenHash: delivery.tokenHash,
        invitationUrl: delivery.invitationUrl ?? null,
        status: delivery.status,
        attempts: delivery.attempts,
        maxAttempts: delivery.maxAttempts,
        nextAttemptAt: delivery.nextAttemptAt,
        providerMessageId: delivery.providerMessageId ?? null,
        lastError: delivery.lastError ?? null,
        lockedAt: delivery.lockedAt ?? null,
        lockedBy: delivery.lockedBy ?? null,
        processedAt: delivery.processedAt ?? null,
      })
      .returning();

    return row as InvitationDeliveryRecord;
  }

  async findById(
    id: string,
    tx?: any,
  ): Promise<InvitationDeliveryRecord | null> {
    const executor = tx ?? db;
    const [row] = await executor
      .select()
      .from(invitationDeliveries)
      .where(eq(invitationDeliveries.id, id));

    if (!row) return null;
    return row as InvitationDeliveryRecord;
  }

  async findByInvitationId(
    invitationId: string,
    tx?: any,
  ): Promise<InvitationDeliveryRecord | null> {
    const executor = tx ?? db;
    const [row] = await executor
      .select()
      .from(invitationDeliveries)
      .where(eq(invitationDeliveries.invitationId, invitationId));

    if (!row) return null;
    return row as InvitationDeliveryRecord;
  }

  async lockPendingForProcessing(
    limit: number = 10,
    workerId: string = "default-worker",
    lockTimeoutMinutes: number = 5,
  ): Promise<InvitationDeliveryRecord[]> {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const lockThreshold = new Date(
        now.getTime() - lockTimeoutMinutes * 60 * 1000,
      );

      const candidates = await tx
        .select()
        .from(invitationDeliveries)
        .where(
          and(
            lt(invitationDeliveries.attempts, invitationDeliveries.maxAttempts),
            or(
              and(
                eq(invitationDeliveries.status, "PENDING"),
                lte(invitationDeliveries.nextAttemptAt, now),
              ),
              and(
                eq(invitationDeliveries.status, "PROCESSING"),
                lt(invitationDeliveries.lockedAt, lockThreshold),
              ),
            ),
          ),
        )
        .orderBy(asc(invitationDeliveries.nextAttemptAt))
        .limit(limit)
        .for("update", { skipLocked: true });

      if (candidates.length === 0) {
        return [];
      }

      const candidateIds = candidates.map((c) => c.id);

      await tx
        .update(invitationDeliveries)
        .set({
          status: "PROCESSING",
          lockedAt: now,
          lockedBy: workerId,
          updatedAt: now,
        })
        .where(inArray(invitationDeliveries.id, candidateIds));

      return candidates.map((c) => ({
        ...c,
        status: "PROCESSING" as const,
        lockedAt: now,
        lockedBy: workerId,
      })) as InvitationDeliveryRecord[];
    });
  }

  async update(delivery: InvitationDeliveryRecord, tx?: any): Promise<void> {
    const executor = tx ?? db;
    const now = new Date();
    await executor
      .update(invitationDeliveries)
      .set({
        status: delivery.status,
        attempts: delivery.attempts,
        nextAttemptAt: delivery.nextAttemptAt,
        providerMessageId: delivery.providerMessageId ?? null,
        lastError: delivery.lastError ?? null,
        invitationUrl: delivery.invitationUrl ?? null,
        lockedAt: delivery.lockedAt ?? null,
        lockedBy: delivery.lockedBy ?? null,
        processedAt: delivery.processedAt ?? null,
        updatedAt: now,
      })
      .where(eq(invitationDeliveries.id, delivery.id));
  }
}
