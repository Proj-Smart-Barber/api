import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Entity } from "../../../core/entities/Entity";
import type { Optional } from "../../../core/types/optional";

export enum Role {
  OWNER = "OWNER",
  BARBERMAN = "BARBERMAN",
}

interface MembershipProps {
  role: Role;
  barbershopId: UniqueEntityId;
  staffId: UniqueEntityId;
  createdAt?: Date;
}

export class Membership extends Entity<MembershipProps> {
  get role(): Role {
    return this.props.role;
  }

  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get staffId(): UniqueEntityId {
    return this.props.staffId;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<MembershipProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const membership = new Membership(
      { ...props, createdAt: props.createdAt ?? new Date() },
      id,
    );

    return membership;
  }
}
