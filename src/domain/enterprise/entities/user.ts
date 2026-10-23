import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";
import type { Password } from "./value-objects/password";

export type AccountType = "CLIENT" | "BARBER" | "OWNER" | "PLATFORM_ADMIN";

interface UserProps {
  name: string;
  avatarUrl?: string;
  email: string;
  password: Password;
  cpf: string;
  phoneNumber?: string;
  emailVerifiedAt?: Date | null;
  accountType?: AccountType;
  credentialVersion?: number;
  onboardingIntent?: "OWNER" | "CLIENT" | null;
  createdAt?: Date;
}

export class User extends Entity<UserProps> {
  get name(): string {
    return this.props.name;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  set avatarUrl(url: string | undefined) {
    this.props.avatarUrl = url;
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

  get accountType(): AccountType {
    return this.props.accountType ?? "CLIENT";
  }

  get credentialVersion(): number {
    return this.props.credentialVersion ?? 1;
  }

  get onboardingIntent(): "OWNER" | "CLIENT" | null | undefined {
    return this.props.onboardingIntent;
  }

  verifyEmail(at: Date = new Date()): void {
    this.props.emailVerifiedAt = at;
  }

  changePassword(newPassword: Password): void {
    this.props.password = newPassword;
  }

  promoteToBarber(): void {
    if (!this.props.accountType || this.props.accountType === "CLIENT") {
      this.props.accountType = "BARBER";
    }
  }

  promoteToOwner(): void {
    this.props.accountType = "OWNER";
    this.props.onboardingIntent = null;
  }

  incrementCredentialVersion(): void {
    this.props.credentialVersion = (this.props.credentialVersion ?? 1) + 1;
  }

  setOnboardingIntent(intent: "OWNER" | "CLIENT" | null): void {
    this.props.onboardingIntent = intent;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  static create(props: Optional<UserProps, "createdAt">, id?: UniqueEntityId) {
    const user = new User(
      {
        ...props,
        accountType: props.accountType ?? "CLIENT",
        credentialVersion: props.credentialVersion ?? 1,
        createdAt: new Date(),
      },
      id,
    );

    return user;
  }
}
