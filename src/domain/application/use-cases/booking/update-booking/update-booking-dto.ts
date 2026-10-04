export interface UpdateBookingDTO {
  bookingId: string;
  barbermanId: string;
  date?: Date;
  startTime?: string;
  endTime?: string;
}
