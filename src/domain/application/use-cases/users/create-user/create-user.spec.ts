import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import { CreateUserUseCase } from "./create-user";

let inMemoryUsersRepository: InMemoryUsersRepository;
let sut: CreateUserUseCase;

describe("Create a new user", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    sut = new CreateUserUseCase(inMemoryUsersRepository);
  });

  it("should be able to create a new user", async () => {
    const response = await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    expect(response.value).toEqual(
      expect.objectContaining({ userId: expect.any(String) }),
    );
  });

  it("should not be able to create a user with an existing email", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com",
      cpf: "00000000001",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a user with an existing cpf", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano2@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a user with an existing cpf or email", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });
});
