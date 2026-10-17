export interface OperationAttemptRecord {
  id: string;
  actorId: string;
  requestId: string;
  operation: string;
  payloadHash: string;
  state: "PENDING" | "APPLIED" | "NOT_APPLIED";
  resourceKind?:
    | "BOOKING"
    | "MEMBERSHIP"
    | "REGISTRATION"
    | "INVITATION"
    | "SCHEDULE"
    | null;
  resourceId?: string | null;
  resourceVersion?: number | null;
  responsePayload?: string | null;
  terminalReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface OperationAttemptsRepository {
  create(
    attempt: OperationAttemptRecord,
    tx?: any,
  ): Promise<OperationAttemptRecord>;
  findByActorAndRequestId(
    actorId: string,
    requestId: string,
    tx?: any,
  ): Promise<OperationAttemptRecord | null>;
  lockByActorAndRequestId(
    actorId: string,
    requestId: string,
    tx: any,
  ): Promise<OperationAttemptRecord | null>;
  update(attempt: OperationAttemptRecord, tx?: any): Promise<void>;
}
