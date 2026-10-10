/** biome-ignore-all lint/complexity/noStaticOnlyClass: mapper class */
import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { shoppingCarts } from "../../../infra/drizzle/schema";
import { ShoppingCart } from "../entities/shopping-cart";

type PersistenceShoppingCart = InferSelectModel<typeof shoppingCarts>;

export class ShoppingCartMapper {
  static toDomain(raw: PersistenceShoppingCart): ShoppingCart {
    return ShoppingCart.create(
      {
        serviceItemId: new UniqueEntityId(raw.serviceItemId),
        userId: new UniqueEntityId(raw.userId),
        totalPriceInCents: raw.totalPriceInCents,
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(cart: ShoppingCart) {
    return {
      id: cart.id.toString(),
      serviceItemId: cart.serviceItemId.toString(),
      userId: cart.userId.toString(),
      totalPriceInCents: cart.totalPriceInCents,
      createdAt: cart.createdAt,
    };
  }

  static toHTTP(cart: ShoppingCart) {
    return {
      id: cart.id.toString(),
      serviceItemId: cart.serviceItemId.toString(),
      userId: cart.userId.toString(),
      totalPriceInCents: cart.totalPriceInCents,
      createdAt: cart.createdAt,
    };
  }
}
