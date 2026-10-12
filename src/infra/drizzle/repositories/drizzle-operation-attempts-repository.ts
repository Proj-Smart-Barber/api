import { and, eq } from "drizzle-orm";
import type {
  OperationAttemptRecord,
  OperationAttemptsRepository,
} from "../../../domain/application/repositories/operation-attempts-repository";
import { db } from "../index";
import { operationAttempts } from "../schema";

export class DrizzleOperationAttemptsRepository
  implements OperationAttemptsRepository
{
  async create(
    attempt: OperationAttemptRecord,
    tx?: any,
  ): Promise<OperationAttemptRecord> {
    const executor = tx ?? db;
    const [created] = await executor
      .insert(operationAttempts)
      .values({
        id: attempt.id,
        actorId: attempt.actorId,
        requestId: attempt.requestId,
        operation: attempt.operation,
        payloadHash: attempt.payloadHash,
        state: attempt.state,
        resourceKind: attempt.resourceKind ?? null,
        resourceId: attempt.resourceId ?? null,
        resourceVersion: attempt.resourceVersion ?? null,
        responsePayload: attempt.responsePayload ?? null,
        terminalReason: attempt.terminalReason ?? null,
        createdAt: attempt.createdAt,
        updatedAt: attempt.updatedAt,
        expiresAt: attempt.expiresAt,
      })
      .returning();

    return created as OperationAttemptRecord;
  }

  async findByActorAndRequestId(
    actorId: string,
    requestId: string,
    tx?: any,
  ): Promise<OperationAttemptRecord | null> {
    const executor = tx ?? db;
    const [row] = await executor
      .select()
      .from(operationAttempts)
      .where(
        and(
          eq(operationAttempts.actorId, actorId),
          eq(operationAttempts.requestId, requestId),
        ),
      );

    if (!row) {
      return null;
    }

    return row as OperationAttemptRecord;
  }

  async lockByActorAndRequestId(
    actorId: string,
    requestId: string,
    tx: any,
  ): Promise<OperationAttemptRecord | null> {
    const [row] = await tx
      .select()
      .from(operationAttempts)
      .where(
        and(
          eq(operationAttempts.actorId, actorId),
          eq(operationAttempts.requestId, requestId),
        ),
      )
      .for("update");

    if (!row) {
      return null;
    }

    return row as OperationAttemptRecord;
  }

  async update(attempt: OperationAttemptRecord, tx?: any): Promise<void> {
    const executor = tx ?? db;
    await executor
      .update(operationAttempts)
      .set({
        state: attempt.state,
        resourceKind: attempt.resourceKind ?? null,
        resourceId: attempt.resourceId ?? null,
        resourceVersion: attempt.resourceVersion ?? null,
        responsePayload: attempt.responsePayload ?? null,
        terminalReason: attempt.terminalReason ?? null,
        updatedAt: attempt.updatedAt,
        expiresAt: attempt.expiresAt,
      })
      .where(eq(operationAttempts.id, attempt.id));
  }
}
