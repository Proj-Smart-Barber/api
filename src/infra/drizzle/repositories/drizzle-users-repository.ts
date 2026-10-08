import { db } from "..";
import { users } from "../schema";
import { UserMapper } from "../../../domain/enterprise/mappers/user-mapper";
import { eq, or } from "drizzle-orm";
import type { UsersRepository } from "../../../domain/application/repositories/users-repository";
import type { User } from "../../../domain/enterprise/entities/user";

export class DrizzleUsersRepository implements UsersRepository {
  async findById(id: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findByCpfOrEmail(cpf: string, email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.cpf, cpf), eq(users.email, email)));

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async save(user: User): Promise<User> {
    const persistence: typeof users.$inferInsert =
      UserMapper.toPersistence(user);

    const [savedUser] = await db
      .insert(users)
      .values(persistence)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...persistence, updatedAt: new Date() },
      })
      .returning();

    return UserMapper.toDomain(savedUser);
  }
}
