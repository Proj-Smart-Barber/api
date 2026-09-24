import type { BookingDetails } from "../../../../enterprise/entities/booking-details";

export interface FetchBarbermanDailyScheduleWithDetailsResponse {
  bookings: BookingDetails[];
}
