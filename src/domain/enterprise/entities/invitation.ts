import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";
import type { Role } from "./membership";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";

interface InvitationProps {
  barbershopId: UniqueEntityId;
  email: string;
  role: Role;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedById: UniqueEntityId;
  respondedAt?: Date | null;
  createdAt?: Date;
}

export class Invitation extends Entity<InvitationProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get email(): string {
    return this.props.email;
  }

  get role(): Role {
    return this.props.role;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get status(): InvitationStatus {
    return this.props.status;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get invitedById(): UniqueEntityId {
    return this.props.invitedById;
  }

  get respondedAt(): Date | null | undefined {
    return this.props.respondedAt;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  isPending(): boolean {
    return this.props.status === "PENDING";
  }

  isExpired(reference: Date = new Date()): boolean {
    return this.props.expiresAt.getTime() <= reference.getTime();
  }

  canBeRespondedTo(reference: Date = new Date()): boolean {
    return this.isPending() && !this.isExpired(reference);
  }

  markAccepted(at: Date = new Date()): void {
    this.props.status = "ACCEPTED";
    this.props.respondedAt = at;
  }

  markDeclined(at: Date = new Date()): void {
    this.props.status = "DECLINED";
    this.props.respondedAt = at;
  }

  revoke(): void {
    this.props.status = "REVOKED";
  }

  static create(
    props: Optional<InvitationProps, "createdAt" | "respondedAt">,
    id?: UniqueEntityId,
  ) {
    const invitation = new Invitation(
      {
        ...props,
        respondedAt: props.respondedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
      },
      id,
    );

    return invitation;
  }
}
