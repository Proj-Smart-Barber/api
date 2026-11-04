import { db } from "..";
import { users } from "../schema";
import { UserMapper } from "../../../domain/enterprise/mappers/user-mapper";
import { eq, or, sql } from "drizzle-orm";
import type { UsersRepository } from "../../../domain/application/repositories/users-repository";
import type { User } from "../../../domain/enterprise/entities/user";
import { Cpf } from "../../../domain/enterprise/entities/value-objects/cpf";

export class DrizzleUsersRepository implements UsersRepository {
  async findById(id: string, tx?: any): Promise<User | null> {
    const executor = tx ?? db;
    const [user] = await executor.select().from(users).where(eq(users.id, id));

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findByEmail(email: string, tx?: any): Promise<User | null> {
    const executor = tx ?? db;
    const normalizedEmail = email.trim().toLowerCase();
    const [user] = await executor
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, normalizedEmail));

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findByCpf(cpf: string, tx?: any): Promise<User | null> {
    const executor = tx ?? db;
    const normalizedCpf = Cpf.normalize(cpf);
    const [user] = await executor
      .select()
      .from(users)
      .where(eq(users.cpf, normalizedCpf));

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findByCpfOrEmail(cpf: string, email: string, tx?: any): Promise<User | null> {
    const executor = tx ?? db;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCpf = Cpf.normalize(cpf);
    const [user] = await executor
      .select()
      .from(users)
      .where(
        or(
          eq(users.cpf, normalizedCpf),
          eq(sql`lower(${users.email})`, normalizedEmail),
        ),
      );

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async save(user: User, tx?: any): Promise<User> {
    const executor = tx ?? db;
    const [createdUser] = await executor
      .insert(users)
      .values({
        name: user.name,
        email: user.email,
        password: user.password.toString(),
        cpf: user.cpf,
        phoneNumber: user.phoneNumber,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
        accountType: user.accountType,
        credentialVersion: user.credentialVersion,
        onboardingIntent: user.onboardingIntent ?? null,
      })
      .returning();

    return UserMapper.toDomain(createdUser);
  }

  async update(user: User, tx?: any): Promise<User> {
    const executor = tx ?? db;
    const [updatedUser] = await executor
      .update(users)
      .set({
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        email: user.email,
        password: user.password.toString(),
        cpf: user.cpf,
        phoneNumber: user.phoneNumber ?? null,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
        accountType: user.accountType,
        credentialVersion: user.credentialVersion,
        onboardingIntent: user.onboardingIntent ?? null,
      })
      .where(eq(users.id, user.id.toString()))
      .returning();

    return UserMapper.toDomain(updatedUser);
  }
}
