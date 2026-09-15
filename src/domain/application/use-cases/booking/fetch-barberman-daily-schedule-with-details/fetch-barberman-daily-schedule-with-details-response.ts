import type { BookingDetails } from "@/domain/enterprise/entities/booking-details";

export interface FetchBarbermanDailyScheduleWithDetailsResponse {
  bookings: BookingDetails[];
}
