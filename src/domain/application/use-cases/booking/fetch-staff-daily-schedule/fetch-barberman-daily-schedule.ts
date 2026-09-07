import { type Either, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { Booking } from "../../../../enterprise/entities/booking";

interface FetchBarbermanDailyScheduleUseCaseRequest {
  barbermanId: string;
  date: Date;
}
type FetchBarbermanDailyScheduleUseCaseResponse = Either<
  null,
  {
    bookings: Booking[];
  }
>;

export class FetchBarbermanDailyScheduleUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}
  async execute({
    barbermanId,
    date,
  }: FetchBarbermanDailyScheduleUseCaseRequest): Promise<FetchBarbermanDailyScheduleUseCaseResponse> {
    const bookings = await this.bookingsRepository.findManyByBarbermanAndDate({
      barbermanId,
      date,
    });

    return right({
      bookings,
    });
  }
}
