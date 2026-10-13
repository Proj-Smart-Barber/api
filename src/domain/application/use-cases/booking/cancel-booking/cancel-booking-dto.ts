export interface CancelBookingDTO {
  bookingId: string;
  actorId?: string;
  barbermanId?: string;
  expectedVersion?: number;
  reason?: string;
  scope?: "PERSONAL" | "UNIT";
  tx?: any;
  serverTime?: Date;
}
