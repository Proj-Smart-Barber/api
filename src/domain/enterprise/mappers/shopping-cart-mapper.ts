/** biome-ignore-all lint/complexity/noStaticOnlyClass: mapper class */
import type { ShoppingCart } from "../entities/shopping-cart";

export class ShoppingCartMapper {
  static toPersistence(cart: ShoppingCart) {
    return {
      id: cart.id.toString(),
      serviceItemId: cart.serviceItemId.toString(),
      userId: cart.userId.toString(),
      totalPriceInCents: cart.totalPriceInCents,
      createdAt: cart.createdAt,
    };
  }
}
