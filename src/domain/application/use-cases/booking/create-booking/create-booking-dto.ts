export interface CreateBookingDTO {
  barbershopId: string;
  barbermanId: string;
  shoppingCartId: string;
  startAt: Date;
  durationInMinutes: number;
}
