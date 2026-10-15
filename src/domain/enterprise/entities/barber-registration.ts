import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export interface BarberRegistrationProps {
  barbershopId: UniqueEntityId;
  invitationId: UniqueEntityId;
  name: string;
  cpf: string;
  email: string;
  tokenHash: string;
  status?: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  expiresAt: Date;
  respondedAt?: Date | null;
  createdAt?: Date;
}

export class BarberRegistration extends Entity<BarberRegistrationProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get invitationId(): UniqueEntityId {
    return this.props.invitationId;
  }

  get name(): string {
    return this.props.name;
  }

  get cpf(): string {
    return this.props.cpf;
  }

  get email(): string {
    return this.props.email;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get status(): "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" {
    return this.props.status ?? "PENDING";
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get respondedAt(): Date | null | undefined {
    return this.props.respondedAt;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  isPending(): boolean {
    return this.status === "PENDING" && this.expiresAt > new Date();
  }

  markCompleted(at: Date = new Date()): void {
    this.props.status = "ACCEPTED";
    this.props.respondedAt = at;
  }

  static create(
    props: Optional<BarberRegistrationProps, "createdAt" | "status">,
    id?: UniqueEntityId,
  ) {
    return new BarberRegistration(
      {
        ...props,
        status: props.status ?? "PENDING",
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );
  }
}
