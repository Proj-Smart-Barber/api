export type InvitationDeliveryStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "FAILED"
  | "REVOKED"
  | "EXPIRED";

export interface InvitationDeliveryRecord {
  id: string;
  invitationId: string;
  barbershopId: string;
  recipientEmail: string;
  recipientName: string;
  barbershopName: string;
  ownerName: string;
  tokenHash: string;
  invitationUrl?: string | null;
  status: InvitationDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  providerMessageId?: string | null;
  lastError?: string | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  processedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvitationDeliveriesRepository {
  create(
    delivery: InvitationDeliveryRecord,
    tx?: any,
  ): Promise<InvitationDeliveryRecord>;
  findById(id: string, tx?: any): Promise<InvitationDeliveryRecord | null>;
  findByInvitationId(
    invitationId: string,
    tx?: any,
  ): Promise<InvitationDeliveryRecord | null>;
  lockPendingForProcessing(
    limit: number,
    workerId: string,
    lockTimeoutMinutes?: number,
  ): Promise<InvitationDeliveryRecord[]>;
  update(delivery: InvitationDeliveryRecord, tx?: any): Promise<void>;
}
