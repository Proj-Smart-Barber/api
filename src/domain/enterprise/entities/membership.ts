import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Entity } from "../../../core/entities/Entity";
import type { Optional } from "../../../core/types/optional";

export enum Role {
  OWNER = "OWNER",
  BARBERMAN = "BARBERMAN",
}

export type MembershipState = "ACTIVE" | "INACTIVE";

export interface MembershipProps {
  role: Role;
  barbershopId: UniqueEntityId;
  userId: UniqueEntityId;
  state?: MembershipState;
  version?: number;
  endedAt?: Date | null;
  createdAt?: Date;
}

export class Membership extends Entity<MembershipProps> {
  get role(): Role {
    return this.props.role;
  }

  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get userId(): UniqueEntityId {
    return this.props.userId;
  }

  get state(): MembershipState {
    return this.props.state ?? "ACTIVE";
  }

  get version(): number {
    return this.props.version ?? 1;
  }

  get endedAt(): Date | null | undefined {
    return this.props.endedAt;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  deactivate(at: Date = new Date()): void {
    this.props.state = "INACTIVE";
    this.props.endedAt = at;
    this.props.version = (this.props.version ?? 1) + 1;
  }

  static create(
    props: Optional<MembershipProps, "createdAt" | "state" | "version">,
    id?: UniqueEntityId,
  ) {
    const membership = new Membership(
      {
        ...props,
        state: props.state ?? "ACTIVE",
        version: props.version ?? 1,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return membership;
  }
}
