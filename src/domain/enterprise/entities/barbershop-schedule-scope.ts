import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export type ScheduleScopeState = "INHERIT" | "CUSTOM" | "CLOSED";

export interface BarbershopScheduleScopeProps {
  barbershopId: UniqueEntityId;
  barbermanId?: UniqueEntityId | null;
  state: ScheduleScopeState;
  version: number;
  lastMutationId?: string | null;
  lastMutationHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BarbershopScheduleScope extends Entity<BarbershopScheduleScopeProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get barbermanId(): UniqueEntityId | null {
    return this.props.barbermanId ?? null;
  }

  get state(): ScheduleScopeState {
    return this.props.state;
  }

  set state(state: ScheduleScopeState) {
    this.props.state = state;
    this.props.updatedAt = new Date();
  }

  get version(): number {
    return this.props.version;
  }

  incrementVersion() {
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  get lastMutationId(): string | null {
    return this.props.lastMutationId ?? null;
  }

  set lastMutationId(id: string | null) {
    this.props.lastMutationId = id;
  }

  get lastMutationHash(): string | null {
    return this.props.lastMutationHash ?? null;
  }

  set lastMutationHash(hash: string | null) {
    this.props.lastMutationHash = hash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static create(
    props: Optional<
      BarbershopScheduleScopeProps,
      "version" | "createdAt" | "updatedAt" | "state"
    >,
    id?: UniqueEntityId,
  ): BarbershopScheduleScope {
    return new BarbershopScheduleScope(
      {
        ...props,
        state: props.state ?? "CUSTOM",
        version: props.version ?? 1,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );
  }
}
