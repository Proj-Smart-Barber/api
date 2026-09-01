import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";

interface ShoppingCartProps {
  serviceItemId: UniqueEntityId;
  customerId: UniqueEntityId;
  totalPriceInCents: number;
  createdAt?: Date;
}

export class ShoppingCart extends Entity<ShoppingCartProps> {
  get serviceItemId(): UniqueEntityId {
    return this.props.serviceItemId;
  }

  get customerId(): UniqueEntityId {
    return this.props.customerId;
  }

  get totalPriceInCents(): number {
    return this.props.totalPriceInCents;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<ShoppingCartProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const shoppingCart = new ShoppingCart(
      {
        ...props,
        createdAt: new Date(),
      },
      id,
    );

    return shoppingCart;
  }
}
