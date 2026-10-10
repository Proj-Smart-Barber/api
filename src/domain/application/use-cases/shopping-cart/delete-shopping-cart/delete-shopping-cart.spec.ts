import { beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryServiceItemsRepository } from "../../../../../../test/repositories/in-memory-service-items-repository";
import { InMemoryShoppingCartsRepository } from "../../../../../../test/repositories/in-memory-shopping-carts-repository";
import { Booking } from "../../../../enterprise/entities/booking";
import { ServiceItem } from "../../../../enterprise/entities/service-item";
import { ShoppingCart } from "../../../../enterprise/entities/shopping-cart";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { DeleteShoppingCartUseCase } from "./delete-shopping-cart";

let inMemoryShoppingCartsRepository: InMemoryShoppingCartsRepository;
let inMemoryServiceItemsRepository: InMemoryServiceItemsRepository;
let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: DeleteShoppingCartUseCase;

describe("Delete Shopping Cart Use Case", () => {
  beforeEach(async () => {
    inMemoryServiceItemsRepository = new InMemoryServiceItemsRepository();
    inMemoryShoppingCartsRepository = new InMemoryShoppingCartsRepository(
      inMemoryServiceItemsRepository,
    );
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new DeleteShoppingCartUseCase(
      inMemoryShoppingCartsRepository,
      inMemoryBookingsRepository,
    );

    inMemoryServiceItemsRepository.items.push(
      ServiceItem.create(
        {
          serviceId: new UniqueEntityId("service-1"),
          titleSnapshot: "Corte de Cabelo",
          priceInCentsSnapshot: 5000,
          durationInMinutesSnapshot: 30,
        },
        new UniqueEntityId("service-item-1"),
      ),
    );

    await inMemoryShoppingCartsRepository.create(
      ShoppingCart.create(
        {
          serviceItemId: new UniqueEntityId("service-item-1"),
          userId: new UniqueEntityId("customer-1"),
          totalPriceInCents: 5000,
        },
        new UniqueEntityId("cart-1"),
      ),
    );
  });

  it("should delete the cart and its service item", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      cartId: "cart-1",
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryShoppingCartsRepository.items).toHaveLength(0);
    expect(inMemoryServiceItemsRepository.items).toHaveLength(0);
  });

  it("should not be able to delete a non-existing cart", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      cartId: "non-existing-cart",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to delete a cart from another user", async () => {
    const result = await sut.execute({
      customerId: "another-customer",
      cartId: "cart-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should not be able to delete a cart that has bookings", async () => {
    await inMemoryBookingsRepository.create(
      Booking.create({
        barbershopId: new UniqueEntityId("barbershop-1"),
        barbermanId: new UniqueEntityId("barberman-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: new Date("2026-09-11T00:00:00.000Z"),
        startTime: "14:00",
        endTime: "14:30",
      }),
    );

    const result = await sut.execute({
      customerId: "customer-1",
      cartId: "cart-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(Error);
    expect(inMemoryShoppingCartsRepository.items).toHaveLength(1);
  });
});
