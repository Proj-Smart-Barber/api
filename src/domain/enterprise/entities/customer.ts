import { Entity } from "@/core/entities/Entity";
import type { UniqueEntityId } from "@/core/entities/unique-entity-id";
import type { Optional } from "@/core/types/optional";
import type { Password } from "./value-objects/password";

interface CustomerProps {
  name: string;
  avatarUrl?: string;
  email: string;
  password: Password;
  cpf: string;
  phoneNumber: string;
  createdAt?: Date;
}

export class Customer extends Entity<CustomerProps> {
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

  get phoneNumber(): string {
    return this.props.phoneNumber;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(
    props: Optional<CustomerProps, "createdAt">,
    id?: UniqueEntityId,
  ) {
    const customer = new Customer(
      {
        ...props,
        createdAt: new Date(),
      },
      id,
    );

    return customer;
  }
}
