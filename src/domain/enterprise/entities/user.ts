import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";
import type { Password } from "./value-objects/password";

interface UserProps {
  name: string;
  avatarUrl?: string;
  email: string;
  password: Password;
  cpf: string;
  phoneNumber?: string;
  emailVerifiedAt?: Date | null;
  createdAt?: Date;
}

export class User extends Entity<UserProps> {
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

  get cpf(): string {
    return this.props.cpf;
  }

  get phoneNumber(): string | undefined {
    return this.props.phoneNumber;
  }

  get emailVerifiedAt(): Date | null | undefined {
    return this.props.emailVerifiedAt;
  }

  get isEmailVerified(): boolean {
    return this.props.emailVerifiedAt != null;
  }

  verifyEmail(at: Date = new Date()): void {
    this.props.emailVerifiedAt = at;
  }

  changePassword(newPassword: Password): void {
    this.props.password = newPassword;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(props: Optional<UserProps, "createdAt">, id?: UniqueEntityId) {
    const user = new User(
      {
        ...props,
        createdAt: new Date(),
      },
      id,
    );

    return user;
  }
}
