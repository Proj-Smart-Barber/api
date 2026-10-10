import { desc, eq } from "drizzle-orm";
import type {
  ShoppingCartWithBarbershop,
  ShoppingCartsRepository,
} from "../../../domain/application/repositories/shopping-carts-repository";
import type { ShoppingCart } from "../../../domain/enterprise/entities/shopping-cart";
import { ShoppingCartMapper } from "../../../domain/enterprise/mappers/shopping-cart-mapper";
import { db } from "../index";
import { serviceItems, services, shoppingCarts } from "../schema";

export class DrizzleShoppingCartsRepository implements ShoppingCartsRepository {
  async create(cart: ShoppingCart): Promise<void> {
    const data = ShoppingCartMapper.toPersistence(cart);
    await db.insert(shoppingCarts).values(data);
  }

  async findById(id: string): Promise<ShoppingCart | null> {
    const [result] = await db
      .select()
      .from(shoppingCarts)
      .where(eq(shoppingCarts.id, id));

    if (!result) return null;

    return ShoppingCartMapper.toDomain(result);
  }

  async findManyByUserId(userId: string): Promise<ShoppingCart[]> {
    const result = await db
      .select()
      .from(shoppingCarts)
      .where(eq(shoppingCarts.userId, userId))
      .orderBy(desc(shoppingCarts.createdAt));

    return result.map((row) => ShoppingCartMapper.toDomain(row));
  }

  async delete(cart: ShoppingCart): Promise<void> {
    const cartId = cart.id.toString();
    const serviceItemId = cart.serviceItemId.toString();

    await db.transaction(async (tx) => {
      await tx.delete(shoppingCarts).where(eq(shoppingCarts.id, cartId));
      await tx.delete(serviceItems).where(eq(serviceItems.id, serviceItemId));
    });
  }

  async findByIdWithBarbershop(
    id: string,
  ): Promise<ShoppingCartWithBarbershop | null> {
    const [result] = await db
      .select({
        cart: shoppingCarts,
        barbershopId: services.barbershopId,
      })
      .from(shoppingCarts)
      .innerJoin(serviceItems, eq(shoppingCarts.serviceItemId, serviceItems.id))
      .innerJoin(services, eq(serviceItems.serviceId, services.id))
      .where(eq(shoppingCarts.id, id));

    if (!result) return null;

    return {
      cart: ShoppingCartMapper.toDomain(result.cart),
      barbershopId: result.barbershopId,
    };
  }
}
