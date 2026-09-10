import { type Either, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { GetAvailableSlotsDTO } from "./get-available-slots-dto";
import type { GetAvailableSlotsResponse } from "./get-available-slots-response";

type GetAvailableSlotsUseCaseResponse = Either<null, GetAvailableSlotsResponse>;

export class GetAvailableSlotsUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}

  async execute({
    barbershopId,
    barbermanId,
    date,
    serviceDurationInMinutes,
  }: GetAvailableSlotsDTO): Promise<GetAvailableSlotsUseCaseResponse> {
    const existingBookings =
      await this.bookingsRepository.findManyByBarbermanAndDate({
        barbermanId,
        date,
      });

    const openHour = 8;
    const closeHour = 18;

    const startShift = new Date(date);
    startShift.setHours(openHour, 0, 0, 0);

    const endShift = new Date(date);
    endShift.setHours(closeHour, 0, 0, 0);

    const slots: { start: string; end: string }[] = [];
    let currentSlotStart = new Date(startShift);

    while (
      currentSlotStart.getTime() + serviceDurationInMinutes * 60 * 1000 <=
      endShift.getTime()
    ) {
      const currentSlotEnd = new Date(
        currentSlotStart.getTime() + serviceDurationInMinutes * 60 * 1000,
      );

      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = booking.createdAt ?? new Date();
        const bookingEnd = new Date(
          bookingStart.getTime() + serviceDurationInMinutes * 60 * 1000,
        );

        return (
          (currentSlotStart >= bookingStart && currentSlotStart < bookingEnd) ||
          (currentSlotEnd > bookingStart && currentSlotEnd <= bookingEnd)
        );
      });

      if (!hasConflict) {
        slots.push({
          start: currentSlotStart.toISOString(),
          end: currentSlotEnd.toISOString(),
        });
      }

      currentSlotStart = new Date(
        currentSlotStart.getTime() + serviceDurationInMinutes * 60 * 1000,
      );
    }

    return right({ slots });
  }
}
