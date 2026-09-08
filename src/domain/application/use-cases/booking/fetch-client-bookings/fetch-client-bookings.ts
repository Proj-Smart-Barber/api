import { type Either, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { Booking } from "../../../../enterprise/entities/booking";
import type { FetchClientBookingsDTO } from "./fetch-client-booking-dto";
import type { FetchClientBookingsResponse } from "./fetch-client-booking-response";
// interface FetchClientBookingsRequest {
//   shoppingCartId: string;
//   page?: number;
// }

// type FetchClientBookingsResponse = Either<
//   null,
//   {
//     bookings: Booking[];
//   }
// >;
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
