import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Entity } from "../../../core/entities/Entity";

export enum Role {
  OWNER,
  BARBERMAN,
}

interface MembershipProps {
  role: Role;
  barbershopId: UniqueEntityId;
  staffId: UniqueEntityId;
}

export class Membership extends Entity<MembershipProps> {
  get role(): Role {
    return this.props.role;
  }

  get babershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get staffId(): UniqueEntityId {
    return this.props.staffId;
  }

  static create(props: MembershipProps, id?: UniqueEntityId) {
    const membership = new Membership(props, id);

    return membership;
  }
}
