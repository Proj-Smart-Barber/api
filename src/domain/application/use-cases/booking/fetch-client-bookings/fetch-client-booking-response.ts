import type { Booking } from "../../../../enterprise/entities/booking";

export interface FetchClientBookingsResponse {
  bookings: Booking[];
}
