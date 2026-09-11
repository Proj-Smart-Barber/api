import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";

interface BookingProps {
  barbershopId: UniqueEntityId;
  barbermanId: UniqueEntityId;
  shoppingCartId: UniqueEntityId;
  // date?: Date; // Descomentar no merge com a branch de Disponibilidade
  // startTime?: string; // Descomentar no merge com a branch de Disponibilidade
  // endTime?: string; // Descomentar no merge com a branch de Disponibilidade
  createdAt?: Date;
}

export class Booking extends Entity<BookingProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get barbermanId(): UniqueEntityId {
    return this.props.barbermanId;
  }

  get shoppingCartId(): UniqueEntityId {
    return this.props.shoppingCartId;
  }
  // get date(): Date | undefined { return this.props.date; }
  // get startTime(): string | undefined { return this.props.startTime; }
  // get endTime(): string | undefined { return this.props.endTime; }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<BookingProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const booking = new Booking(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return booking;
  }
}
