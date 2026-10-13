export interface RescheduleBookingDTO {
  bookingId: string;
  actorId: string;
  expectedVersion?: number;
  date: string;
  startTime: string;
  slotStartAt?: string;
  barbermanId?: string;
  serviceIds?: string[];
  expectedTotalPriceInCents?: number;
  expectedDurationInMinutes?: number;
  scope?: "PERSONAL" | "UNIT";
  reason?: string;
  tx?: any;
  serverTime?: Date;
}
