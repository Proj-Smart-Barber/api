import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { type Either, left, right } from "../../../../../core/logic/either";
import { ShoppingCart } from "../../../../enterprise/entities/shopping-cart";
import type { ServiceItemsRepository } from "../../../repositories/service-items-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { ShoppingCartsRepository } from "../../../repositories/shopping-carts-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { CreateShoppingCartDTO } from "./create-shopping-cart-dto";
import type { CreateShoppingCartResponse } from "./create-shopping-cart-response";

type CreateShoppingCartUseCaseResponse = Either<
  Error,
  CreateShoppingCartResponse
>;

export class CreateShoppingCartUseCase {
  constructor(
    private shoppingCartsRepository: ShoppingCartsRepository,
    private serviceItemsRepository: ServiceItemsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    customerId,
    serviceItemId,
  }: CreateShoppingCartDTO): Promise<CreateShoppingCartUseCaseResponse> {
    const serviceItem =
      await this.serviceItemsRepository.findById(serviceItemId);

    if (!serviceItem) {
      return left(new ResourceNotFoundError("Item de serviço não encontrado."));
    }

    let totalPriceInCents = serviceItem.priceInCentsSnapshot;

    if (totalPriceInCents === undefined) {
      const service = await this.servicesRepository.findById(
        serviceItem.serviceId.toString(),
      );

      if (!service) {
        return left(new ResourceNotFoundError("Serviço não encontrado."));
      }

      totalPriceInCents = service.priceInCents;
    }

    const cart = ShoppingCart.create({
      serviceItemId: new UniqueEntityId(serviceItemId),
      userId: new UniqueEntityId(customerId),
      totalPriceInCents,
    });

    await this.shoppingCartsRepository.create(cart);

    return right({ cart });
  }
}
