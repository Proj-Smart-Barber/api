export interface CreateBookingDTO {
  customerId: string;
  barbermanId: string;
  serviceId?: string;
  serviceIds?: string[];
  date: string;
  startTime: string;
  endTime?: string;
  expectedTotalPriceInCents?: number;
  expectedDurationInMinutes?: number;
}
