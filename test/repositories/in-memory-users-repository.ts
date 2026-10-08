import type { UsersRepository } from "../../src/domain/application/repositories/users-repository";
import type { User } from "../../src/domain/enterprise/entities/user";

export class InMemoryUsersRepository implements UsersRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    const user = this.users.find((user) => user.id.toString() === id);

    if (!user) {
      return null;
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = this.users.find((user) => user.email === email);

    if (!user) {
      return null;
    }

    return user;
  }

  async findByCpfOrEmail(cpf: string, email: string): Promise<User | null> {
    const user = this.users.find(
      (user) => user.cpf === cpf || user.email === email,
    );

    if (!user) {
      return null;
    }

    return user;
  }

  async save(user: User): Promise<User> {
    const index = this.users.findIndex(
      (candidate) => candidate.id.toString() === user.id.toString(),
    );

    if (index >= 0) {
      this.users[index] = user;
      return user;
    }

    this.users.push(user);

    return user;
  }
}
