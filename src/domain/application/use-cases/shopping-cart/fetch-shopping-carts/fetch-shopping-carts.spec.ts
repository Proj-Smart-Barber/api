import { beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryShoppingCartsRepository } from "../../../../../../test/repositories/in-memory-shopping-carts-repository";
import { ShoppingCart } from "../../../../enterprise/entities/shopping-cart";
import { FetchShoppingCartsUseCase } from "./fetch-shopping-carts";

let inMemoryShoppingCartsRepository: InMemoryShoppingCartsRepository;
let sut: FetchShoppingCartsUseCase;

function makeCart(
  cartId: string,
  userId: string,
  createdAt: Date,
): ShoppingCart {
  return ShoppingCart.create(
    {
      serviceItemId: new UniqueEntityId("service-item-1"),
      userId: new UniqueEntityId(userId),
      totalPriceInCents: 5000,
      createdAt,
    },
    new UniqueEntityId(cartId),
  );
}

describe("Fetch Shopping Carts Use Case", () => {
  beforeEach(() => {
    inMemoryShoppingCartsRepository = new InMemoryShoppingCartsRepository();
    sut = new FetchShoppingCartsUseCase(inMemoryShoppingCartsRepository);
  });

  it("should return only the authenticated customer's carts, most recent first", async () => {
    await inMemoryShoppingCartsRepository.create(
      makeCart("cart-1", "customer-1", new Date("2026-09-10T10:00:00.000Z")),
    );
    await inMemoryShoppingCartsRepository.create(
      makeCart("cart-2", "customer-1", new Date("2026-09-11T10:00:00.000Z")),
    );
    await inMemoryShoppingCartsRepository.create(
      makeCart(
        "cart-3",
        "another-customer",
        new Date("2026-09-12T10:00:00.000Z"),
      ),
    );

    const result = await sut.execute({ customerId: "customer-1" });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      expect(result.value.carts).toHaveLength(2);
      expect(result.value.carts.map((cart) => cart.id.toString())).toEqual([
        "cart-2",
        "cart-1",
      ]);
    }
  });

  it("should return an empty list when the customer has no carts", async () => {
    const result = await sut.execute({ customerId: "customer-1" });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      expect(result.value.carts).toHaveLength(0);
    }
  });
});
