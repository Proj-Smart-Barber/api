export interface CreateBookingDTO {
  actorId?: string;
  scope?: "PERSONAL" | "UNIT";
  shopId?: string;
  customerId?: string;
  barbermanId: string;
  serviceId?: string;
  serviceIds?: string[];
  date: string;
  startTime: string;
  endTime?: string;
  slotStartAt?: string;
  expectedTotalPriceInCents?: number;
  expectedDurationInMinutes?: number;
  clientRequestId?: string;
  tx?: any;
}
