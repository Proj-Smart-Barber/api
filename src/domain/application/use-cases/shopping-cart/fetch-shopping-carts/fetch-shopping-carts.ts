import { type Either, right } from "../../../../../core/logic/either";
import type { ShoppingCartsRepository } from "../../../repositories/shopping-carts-repository";
import type { FetchShoppingCartsDTO } from "./fetch-shopping-carts-dto";
import type { FetchShoppingCartsResponse } from "./fetch-shopping-carts-response";

type FetchShoppingCartsUseCaseResponse = Either<
  null,
  FetchShoppingCartsResponse
>;

export class FetchShoppingCartsUseCase {
  constructor(private shoppingCartsRepository: ShoppingCartsRepository) {}

  async execute({
    customerId,
  }: FetchShoppingCartsDTO): Promise<FetchShoppingCartsUseCaseResponse> {
    const carts =
      await this.shoppingCartsRepository.findManyByUserId(customerId);

    return right({ carts });
  }
}
