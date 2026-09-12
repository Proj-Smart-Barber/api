import { type Either, right } from "@/core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { FetchBarbermanDailyScheduleWithDetailsDTO } from "./fetch-barberman-daily-schedule-with-details-dto";
import type { FetchBarbermanDailyScheduleWithDetailsResponse } from "./fetch-barberman-daily-schedule-with-details-response";

type FetchBarbermanDailyScheduleWithDetailsUseCaseResponse = Either<
  null,
  FetchBarbermanDailyScheduleWithDetailsResponse
>;

export class FetchBarbermanDailyScheduleWithDetailsUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}

  async execute({
    barbermanId,
    date,
  }: FetchBarbermanDailyScheduleWithDetailsDTO): Promise<FetchBarbermanDailyScheduleWithDetailsUseCaseResponse> {
    const bookings =
      await this.bookingsRepository.findManyWithDetailsByBarbermanAndDate({
        barbermanId,
        date,
      });

    return right({
      bookings,
    });
  }
}
