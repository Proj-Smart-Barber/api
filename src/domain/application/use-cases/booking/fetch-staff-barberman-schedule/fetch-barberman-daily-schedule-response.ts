import type { Booking } from "../../../../enterprise/entities/booking";

export interface FetchBarbermanDailyScheduleResponse {
  bookings: Booking[];
}
