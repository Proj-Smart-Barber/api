export interface TransitionBookingStatusDTO {
  bookingId: string;
  actorId: string;
  status: "COMPLETED" | "NO_SHOW";
  expectedVersion?: number;
  reason?: string;
}
