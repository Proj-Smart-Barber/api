import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { UpdateUserProfileUseCase } from "./update-user-profile";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";

describe("UpdateUserProfileUseCase", () => {
  let inMemoryUsersRepository: InMemoryUsersRepository;
  let sut: UpdateUserProfileUseCase;

  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    sut = new UpdateUserProfileUseCase(inMemoryUsersRepository);
  });

  it("deve atualizar nome e telefone de um usuário existente", async () => {
    const password = Password.create("hashed-password-123");
    const user = User.create({
      name: "Nome Antigo",
      email: "cliente@smartbarber.com",
      password,
      cpf: "12345678900",
      phoneNumber: "11999999999",
    });
    await inMemoryUsersRepository.save(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      name: "Novo Nome",
      phoneNumber: "11988888888",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.user.name).toBe("Novo Nome");
      expect(result.value.user.phoneNumber).toBe("11988888888");
      expect(result.value.user.email).toBe("cliente@smartbarber.com"); // imutável
    }
  });

  it("deve retornar ResourceNotFoundError quando o usuário não existir", async () => {
    const result = await sut.execute({
      userId: "00000000-0000-0000-0000-000000000000",
      name: "Tentativa Inválida",
    });

    expect(result.isLeft()).toBe(true);
  });
});
