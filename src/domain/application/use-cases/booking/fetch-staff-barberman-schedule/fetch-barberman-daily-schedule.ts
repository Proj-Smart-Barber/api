import { type Either, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { FetchBarbermanDailyScheduleDTO } from "./fetch-barberman-daily-schedule-dto";
import type { FetchBarbermanDailyScheduleResponse } from "./fetch-barberman-daily-schedule-response";
import type { FetchScheduleError } from "../../_errors/fetch-schedule-error";
type FetchBarbermanDailyScheduleUseCaseResponse = Either<
  FetchScheduleError,
  FetchBarbermanDailyScheduleResponse
>;

export class FetchBarbermanDailyScheduleUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}
  async execute({
    barbermanId,
    date,
  }: FetchBarbermanDailyScheduleDTO): Promise<FetchBarbermanDailyScheduleUseCaseResponse> {
    const bookings = await this.bookingsRepository.findManyByBarbermanAndDate({
      barbermanId,
      date,
    });

    return right({
      bookings,
    });
  }
}
