import type { ShoppingCart } from "../../enterprise/entities/shopping-cart";

export interface ShoppingCartWithBarbershop {
  cart: ShoppingCart;
  barbershopId: string;
}

export interface ShoppingCartsRepository {
  create(cart: ShoppingCart): Promise<void>;
  findById(id: string): Promise<ShoppingCart | null>;
  findManyByUserId(userId: string): Promise<ShoppingCart[]>;
  delete(cart: ShoppingCart): Promise<void>;
  findByIdWithBarbershop(
    id: string,
  ): Promise<ShoppingCartWithBarbershop | null>;
}
