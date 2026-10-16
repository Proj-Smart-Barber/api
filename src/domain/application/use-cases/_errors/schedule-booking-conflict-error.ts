import type { UseCaseError } from "../../../../core/errors/use-case-error";

export interface ConflictingBooking {
  bookingId: string;
  date: string;
  startTime: string;
  endTime: string;
  barbermanId: string;
}

export class ScheduleBookingConflictError
  extends Error
  implements UseCaseError
{
  readonly code = "SCHEDULE_BOOKING_CONFLICT";
  readonly conflictingBookings: ConflictingBooking[];

  constructor(conflictingBookings: ConflictingBooking[]) {
    super(
      "Existem agendamentos futuros confirmados que entram em conflito com a nova jornada.",
    );
    this.conflictingBookings = conflictingBookings;
  }
}
