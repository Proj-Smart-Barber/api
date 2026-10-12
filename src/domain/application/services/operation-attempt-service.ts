import { randomUUID } from "node:crypto";
import type {
  OperationAttemptRecord,
  OperationAttemptsRepository,
} from "../repositories/operation-attempts-repository";
import type { ProfessionalMembershipUnitOfWork } from "./professional-membership-unit-of-work";

export type OperationResourceKind =
  | "BOOKING"
  | "MEMBERSHIP"
  | "REGISTRATION"
  | "INVITATION";

export type OperationAttemptState = "PENDING" | "APPLIED" | "NOT_APPLIED";

export interface OperationAttemptResource<T = any> {
  kind?: OperationResourceKind | null;
  id?: string | null;
  version?: number | null;
  data?: T;
}

export interface OperationAttemptResult<T = any> {
  state: OperationAttemptState;
  operation?: string;
  resource?: OperationAttemptResource<T>;
  accessChanged?: boolean;
  serverTime: string;
}

export interface ExecuteOnceParams {
  actorId: string;
  operation: string;
  requestId: string;
  payloadHash: string;
  resourceKind?: OperationResourceKind;
}

export interface CommandSuccessResult<T = any> {
  resourceKind: OperationResourceKind;
  resourceId?: string | null;
  resourceVersion?: number | null;
  data?: T;
}

export class OperationAttemptService {
  constructor(
    private attemptsRepository: OperationAttemptsRepository,
    private unitOfWork: ProfessionalMembershipUnitOfWork,
  ) {}

  async executeOnce<T>(
    params: ExecuteOnceParams,
    command: (
      tx: any,
      context: { serverTime: Date },
    ) => Promise<CommandSuccessResult<T>>,
  ): Promise<OperationAttemptResult<T>> {
    return await this.unitOfWork.withLocks(
      {
        attempt: { actorId: params.actorId, requestId: params.requestId },
      },
      async (tx, { serverTime }) => {
        const existing = await this.attemptsRepository.lockByActorAndRequestId(
          params.actorId,
          params.requestId,
          tx,
        );

        if (existing) {
          if (
            existing.payloadHash &&
            existing.payloadHash !== params.payloadHash
          ) {
            throw new Error("IDEMPOTENCY_PAYLOAD_MISMATCH");
          }

          if (existing.state === "APPLIED") {
            return {
              state: "APPLIED",
              operation: existing.operation,
              resource: {
                kind: existing.resourceKind,
                id: existing.resourceId,
                version: existing.resourceVersion,
                data: existing.responsePayload
                  ? JSON.parse(existing.responsePayload)
                  : undefined,
              },
              serverTime: serverTime.toISOString(),
            };
          }

          if (existing.state === "NOT_APPLIED") {
            throw new Error("OPERATION_ALREADY_CLOSED");
          }

          if (existing.state === "PENDING") {
            return {
              state: "PENDING",
              operation: existing.operation,
              serverTime: serverTime.toISOString(),
            };
          }
        }

        // Record new attempt as PENDING
        const expiresAt = new Date(serverTime.getTime() + 24 * 60 * 60 * 1000); // 24h TTL
        const attempt: OperationAttemptRecord = {
          id: randomUUID(),
          actorId: params.actorId,
          requestId: params.requestId,
          operation: params.operation,
          payloadHash: params.payloadHash,
          state: "PENDING",
          resourceKind: params.resourceKind ?? null,
          resourceId: null,
          resourceVersion: null,
          responsePayload: null,
          terminalReason: null,
          createdAt: serverTime,
          updatedAt: serverTime,
          expiresAt,
        };

        await this.attemptsRepository.create(attempt, tx);

        // Execute command inside transaction
        const result = await command(tx, { serverTime });

        // Update attempt to APPLIED
        attempt.state = "APPLIED";
        attempt.resourceKind = result.resourceKind;
        attempt.resourceId = result.resourceId ?? null;
        attempt.resourceVersion = result.resourceVersion ?? null;
        attempt.responsePayload = result.data
          ? JSON.stringify(result.data)
          : null;
        attempt.updatedAt = serverTime;

        await this.attemptsRepository.update(attempt, tx);

        return {
          state: "APPLIED",
          operation: params.operation,
          resource: {
            kind: result.resourceKind,
            id: result.resourceId,
            version: result.resourceVersion,
            data: result.data,
          },
          serverTime: serverTime.toISOString(),
        };
      },
    );
  }

  async getOwnAttempt(
    actorId: string,
    requestId: string,
  ): Promise<OperationAttemptResult | null> {
    const attempt = await this.attemptsRepository.findByActorAndRequestId(
      actorId,
      requestId,
    );

    if (!attempt) {
      return null;
    }

    return {
      state: attempt.state,
      operation: attempt.operation,
      resource: {
        kind: attempt.resourceKind,
        id: attempt.resourceId,
        version: attempt.resourceVersion,
        data: attempt.responsePayload
          ? JSON.parse(attempt.responsePayload)
          : undefined,
      },
      serverTime: new Date().toISOString(),
    };
  }

  async closeOwnAttempt(
    actorId: string,
    requestId: string,
  ): Promise<OperationAttemptResult> {
    return await this.unitOfWork.withLocks(
      {
        attempt: { actorId, requestId },
      },
      async (tx, { serverTime }) => {
        const existing = await this.attemptsRepository.lockByActorAndRequestId(
          actorId,
          requestId,
          tx,
        );

        if (existing) {
          if (existing.state === "APPLIED") {
            return {
              state: "APPLIED",
              operation: existing.operation,
              resource: {
                kind: existing.resourceKind,
                id: existing.resourceId,
                version: existing.resourceVersion,
                data: existing.responsePayload
                  ? JSON.parse(existing.responsePayload)
                  : undefined,
              },
              serverTime: serverTime.toISOString(),
            };
          }

          if (existing.state === "NOT_APPLIED") {
            return {
              state: "NOT_APPLIED",
              operation: existing.operation,
              serverTime: serverTime.toISOString(),
            };
          }

          return {
            state: "PENDING",
            operation: existing.operation,
            serverTime: serverTime.toISOString(),
          };
        }

        const expiresAt = new Date(serverTime.getTime() + 24 * 60 * 60 * 1000);
        const attempt: OperationAttemptRecord = {
          id: randomUUID(),
          actorId,
          requestId,
          operation: "CLOSED",
          payloadHash: "",
          state: "NOT_APPLIED",
          terminalReason: "CLOSED_BY_ACTOR",
          createdAt: serverTime,
          updatedAt: serverTime,
          expiresAt,
        };

        await this.attemptsRepository.create(attempt, tx);

        return {
          state: "NOT_APPLIED",
          operation: "CLOSED",
          serverTime: serverTime.toISOString(),
        };
      },
    );
  }
}
