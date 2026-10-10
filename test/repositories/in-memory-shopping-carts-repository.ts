import type {
  ShoppingCartWithBarbershop,
  ShoppingCartsRepository,
} from "../../src/domain/application/repositories/shopping-carts-repository";
import type { ShoppingCart } from "../../src/domain/enterprise/entities/shopping-cart";
import type { InMemoryServiceItemsRepository } from "./in-memory-service-items-repository";

export class InMemoryShoppingCartsRepository
  implements ShoppingCartsRepository
{
  public items: ShoppingCart[] = [];
  private barbershopIds = new Map<string, string>();

  constructor(
    private serviceItemsRepository?: InMemoryServiceItemsRepository,
  ) {}

  async create(cart: ShoppingCart): Promise<void> {
    this.items.push(cart);
  }

  async findById(id: string): Promise<ShoppingCart | null> {
    const cart = this.items.find((item) => item.id.toString() === id);

    return cart ?? null;
  }

  async findManyByUserId(userId: string): Promise<ShoppingCart[]> {
    return this.items
      .filter((item) => item.userId.toString() === userId)
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() ?? 0;
        const bTime = b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      });
  }

  async delete(cart: ShoppingCart): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === cart.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items.splice(itemIndex, 1);
    }

    await this.serviceItemsRepository?.deleteById(
      cart.serviceItemId.toString(),
    );
  }

  async seed(cart: ShoppingCart, barbershopId: string): Promise<void> {
    this.items.push(cart);
    this.barbershopIds.set(cart.id.toString(), barbershopId);
  }

  async findByIdWithBarbershop(
    id: string,
  ): Promise<ShoppingCartWithBarbershop | null> {
    const cart = this.items.find((item) => item.id.toString() === id);

    if (!cart) return null;

    const barbershopId = this.barbershopIds.get(cart.id.toString());

    if (!barbershopId) return null;

    return { cart, barbershopId };
  }
}
