import type { User } from "../../enterprise/entities/user";

export interface UsersRepository {
  findById(id: string, tx?: any): Promise<User | null>;
  findByEmail(email: string, tx?: any): Promise<User | null>;
  findByCpf(cpf: string, tx?: any): Promise<User | null>;
  findByCpfOrEmail(cpf: string, email: string, tx?: any): Promise<User | null>;
  save(user: User, tx?: any): Promise<User>;
  update(user: User, tx?: any): Promise<User>;
}
