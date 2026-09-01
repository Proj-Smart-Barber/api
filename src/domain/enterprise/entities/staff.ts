import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";
import type { Password } from "./value-objects/password";

export enum StaffRole {
  OWNER,
  BARBERMAN,
}

interface StaffProps {
  name: string;
  avatarUrl?: string;
  email: string;
  password: Password;
  role: StaffRole;
  cpf: string;
  createdAt?: Date;
}

export class Staff extends Entity<StaffProps> {
  get name(): string {
    return this.props.name;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get email(): string {
    return this.props.email;
  }

  get password(): Password {
    return this.props.password;
  }

  get role(): StaffRole {
    return this.props.role;
  }

  get cpf(): string {
    return this.props.cpf;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(props: Optional<StaffProps, "createdAt">, id?: UniqueEntityId) {
    const staff = new Staff(
      {
        ...props,
        createdAt: new Date(),
      },
      id,
    );

    return staff;
  }
}
