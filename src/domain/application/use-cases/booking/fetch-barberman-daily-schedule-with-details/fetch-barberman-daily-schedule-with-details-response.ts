import type { BookingDetails } from "@/domain/enterprise/entities/value-objects/booking-details";

export interface FetchBarbermanDailyScheduleWithDetailsResponse {
  bookings: BookingDetails[];
}
