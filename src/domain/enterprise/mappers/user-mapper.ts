import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { users } from "../../../infra/drizzle/schema";
import { User } from "../entities/user";
import { Password } from "../entities/value-objects/password";

type PersistenceUser = InferSelectModel<typeof users>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class UserMapper {
  static toDomain(raw: PersistenceUser) {
    return User.create(
      {
        name: raw.name,
        avatarUrl: raw.avatarUrl ?? undefined,
        password: raw.password ? Password.create(raw.password) : undefined,
        email: raw.email,
        cpf: raw.cpf,
        phoneNumber: raw.phoneNumber ?? undefined,
        role: raw.role ?? "CLIENT",
        emailVerified: raw.emailVerified ?? false,
        createdAt: raw.createdAt ?? new Date(),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(user: User) {
    return {
      id: user.id.toString(),
      name: user.name,
      avatarUrl: user.avatarUrl,
      password: user.password?.toString() ?? null,
      email: user.email,
      cpf: user.cpf,
      phoneNumber: user.phoneNumber,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt ?? new Date(),
    };
  }
}
