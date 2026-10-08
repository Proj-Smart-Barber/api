import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";
import type { UserRole } from "../../application/gateways/auth-gateway";
import type { Password } from "./value-objects/password";

interface UserProps {
  name: string;
  avatarUrl?: string;
  email: string;
  /** Legado: credenciais atuais ficam em `account` (better-auth). */
  password?: Password;
  cpf: string;
  phoneNumber?: string;
  /** Tipo da conta (CLIENT, BARBER, OWNER, PLATFORM_ADMIN). */
  role?: UserRole;
  emailVerified?: boolean;
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

  get password(): Password | undefined {
    return this.props.password;
  }

  get cpf(): string {
    return this.props.cpf;
  }

  get phoneNumber(): string | undefined {
    return this.props.phoneNumber;
  }

  get role(): UserRole {
    return this.props.role ?? "CLIENT";
  }

  get emailVerified(): boolean {
    return this.props.emailVerified ?? false;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  /** Altera o tipo da conta (definido somente pelo servidor). */
  assignRole(role: UserRole): void {
    this.props.role = role;
  }

  /** Marca a conta como e-mail confirmado (somente após token válido). */
  markEmailAsVerified(): void {
    this.props.emailVerified = true;
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
