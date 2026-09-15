import { type Either, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { FetchClientBookingsDTO } from "./fetch-client-booking-dto";
import type { FetchClientBookingsResponse } from "./fetch-client-booking-response";

type FetchClientBookingsUseCaseResponse = Either<
  null,
  FetchClientBookingsResponse
>;

export class FetchClientBookingsUseCase {
  constructor(private bookingsRepository: BookingsRepository) {}

  async execute({
    shoppingCartId,
    page = 1,
  }: FetchClientBookingsDTO): Promise<FetchClientBookingsUseCaseResponse> {
    const bookings = await this.bookingsRepository.findManyByShoppingCart({
      shoppingCartId,
      page,
    });

    return right({
      bookings,
    });
  }
}
