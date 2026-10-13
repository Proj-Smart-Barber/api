import type { Booking } from "../../../../enterprise/entities/booking";
import type { Barbershop } from "../../../../enterprise/entities/barbershop";

export interface NotifyBookingEventDTO {
  booking: Booking;
  barbershop?: Barbershop;
  eventType: "UPDATED" | "RESCHEDULED" | "CANCELLED";
  dateText?: string;
  timeText?: string;
  serverTime?: Date;
  tx?: any;
  previousBarbermanId?: string;
}
