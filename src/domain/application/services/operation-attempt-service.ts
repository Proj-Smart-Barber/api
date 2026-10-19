import { randomUUID } from "node:crypto";
import {
  extractUuidV7Timestamp,
  isValidUuidV7,
} from "../../../core/security/uuidv7";
import type {
  OperationAttemptRecord,
  OperationAttemptsRepository,
} from "../repositories/operation-attempts-repository";
import type {
  LockResources,
  ProfessionalMembershipUnitOfWork,
} from "./professional-membership-unit-of-work";
import type { ResourceAccessValidator } from "./resource-access-validator";

export type OperationResourceKind =
  | "BOOKING"
  | "MEMBERSHIP"
  | "REGISTRATION"
  | "INVITATION"
  | "SCHEDULE";

export type OperationAttemptState =
  | "PENDING"
  | "APPLIED"
  | "NOT_APPLIED"
  | "UNKNOWN";

export class IdempotencyKeyError extends Error {
  constructor(
    public code:
      | "INVALID_IDEMPOTENCY_KEY"
      | "IDEMPOTENCY_KEY_FUTURE_TIMESTAMP"
      | "IDEMPOTENCY_KEY_EXPIRED"
      | "IDEMPOTENCY_PAYLOAD_MISMATCH"
      | "OPERATION_ALREADY_CLOSED",
    message: string,
  ) {
    super(message);
    this.name = "IdempotencyKeyError";
  }
}

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
  lockResources?: Omit<LockResources, "attempt">;
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
    private accessValidator?: ResourceAccessValidator,
  ) {}

  private async checkAccess(
    actorId: string,
    resourceKind?: OperationResourceKind | null,
    resourceId?: string | null,
    tx?: any,
  ): Promise<boolean> {
    if (!this.accessValidator || !resourceKind || !resourceId) {
      return true;
    }
    try {
      return await this.accessValidator.canAccess(
        actorId,
        resourceKind,
        resourceId,
        tx,
      );
    } catch {
      return false;
    }
  }

  async executeOnce<T>(
    params: ExecuteOnceParams,
    command: (
      tx: any,
      context: { serverTime: Date },
    ) => Promise<CommandSuccessResult<T>>,
  ): Promise<OperationAttemptResult<T>> {
    const timeMs = extractUuidV7Timestamp(params.requestId);
    if (timeMs === null) {
      throw new IdempotencyKeyError(
        "INVALID_IDEMPOTENCY_KEY",
        "Chave de idempotência inválida. Deve ser UUIDv7 com timestamp válido.",
      );
    }

    return await this.unitOfWork.withLocks(
      {
        attempt: { actorId: params.actorId, requestId: params.requestId },
        ...params.lockResources,
      },
      async (tx, { serverTime }) => {
        // Tolerância de futuro estrita: máximo 5 minutos em relação à autoridade PG
        if (timeMs > serverTime.getTime() + 5 * 60 * 1000) {
          throw new IdempotencyKeyError(
            "IDEMPOTENCY_KEY_FUTURE_TIMESTAMP",
            "Chave de idempotência com timestamp no futuro superior a 5 minutos.",
          );
        }

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
            throw new IdempotencyKeyError(
              "IDEMPOTENCY_PAYLOAD_MISMATCH",
              "Payload incompatível com a chave de tentativa.",
            );
          }

          if (existing.state === "APPLIED") {
            const hasAccess = await this.checkAccess(
              params.actorId,
              existing.resourceKind,
              existing.resourceId,
              tx,
            );

            return {
              state: "APPLIED",
              operation: existing.operation,
              resource: {
                kind: existing.resourceKind,
                id: existing.resourceId,
                version: existing.resourceVersion,
                data:
                  hasAccess && existing.responsePayload
                    ? JSON.parse(existing.responsePayload)
                    : undefined,
              },
              accessChanged: !hasAccess,
              serverTime: serverTime.toISOString(),
            };
          }

          if (existing.state === "NOT_APPLIED") {
            throw new IdempotencyKeyError(
              "OPERATION_ALREADY_CLOSED",
              "Operação já encerrada anteriormente.",
            );
          }

          if (existing.state === "PENDING") {
            return {
              state: "PENDING",
              operation: existing.operation,
              serverTime: serverTime.toISOString(),
            };
          }
        }

        // Se nova tentativa, validar expiração da janela de 24 horas
        if (timeMs < serverTime.getTime() - 24 * 60 * 60 * 1000) {
          throw new IdempotencyKeyError(
            "IDEMPOTENCY_KEY_EXPIRED",
            "Chave de idempotência expirada (janela superior a 24 horas).",
          );
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

        // Execute command inside shared transaction
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
          accessChanged: false,
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

    const hasAccess = await this.checkAccess(
      actorId,
      attempt.resourceKind,
      attempt.resourceId,
    );

    return {
      state: attempt.state,
      operation: attempt.operation,
      resource: {
        kind: attempt.resourceKind,
        id: attempt.resourceId,
        version: attempt.resourceVersion,
        data:
          hasAccess && attempt.responsePayload
            ? JSON.parse(attempt.responsePayload)
            : undefined,
      },
      accessChanged: !hasAccess,
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
            const hasAccess = await this.checkAccess(
              actorId,
              existing.resourceKind,
              existing.resourceId,
              tx,
            );

            return {
              state: "APPLIED",
              operation: existing.operation,
              resource: {
                kind: existing.resourceKind,
                id: existing.resourceId,
                version: existing.resourceVersion,
                data:
                  hasAccess && existing.responsePayload
                    ? JSON.parse(existing.responsePayload)
                    : undefined,
              },
              accessChanged: !hasAccess,
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
