import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { ShoppingCartsRepository } from "../../../repositories/shopping-carts-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { DeleteShoppingCartDTO } from "./delete-shopping-cart-dto";
import type { DeleteShoppingCartResponse } from "./delete-shopping-cart-response";

type DeleteShoppingCartUseCaseResponse = Either<
  Error,
  DeleteShoppingCartResponse
>;

export class DeleteShoppingCartUseCase {
  constructor(
    private shoppingCartsRepository: ShoppingCartsRepository,
    private bookingsRepository: BookingsRepository,
  ) {}

  async execute({
    customerId,
    cartId,
  }: DeleteShoppingCartDTO): Promise<DeleteShoppingCartUseCaseResponse> {
    const cart = await this.shoppingCartsRepository.findById(cartId);

    if (!cart) {
      return left(new ResourceNotFoundError("Carrinho não encontrado."));
    }

    if (cart.userId.toString() !== customerId) {
      return left(
        new NotAllowedError(
          "Este carrinho não pertence ao usuário autenticado.",
        ),
      );
    }

    const bookings = await this.bookingsRepository.findManyByShoppingCart({
      shoppingCartId: cartId,
    });

    if (bookings.length > 0) {
      return left(
        new Error("Não é possível excluir um carrinho que possui reservas."),
      );
    }

    await this.shoppingCartsRepository.delete(cart);

    return right({ cart });
  }
}
