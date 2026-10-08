import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { FakeAuthGateway } from "../../../../../../test/repositories/fake-auth-gateway";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import { InvalidCpfError } from "../../_errors/invalid-cpf-error";
import { WeakPasswordError } from "../../_errors/weak-password-error";
import { CreateUserUseCase } from "./create-user";

let inMemoryUsersRepository: InMemoryUsersRepository;
let fakeAuthGateway: FakeAuthGateway;
let sut: CreateUserUseCase;

describe("Create a new user", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    fakeAuthGateway = new FakeAuthGateway(inMemoryUsersRepository);
    sut = new CreateUserUseCase(inMemoryUsersRepository, fakeAuthGateway);
  });

  it("should be able to create a new user", async () => {
    const response = await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "529.982.247-25",
      password: "12345678",
    });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual(
      expect.objectContaining({ userId: expect.any(String) }),
    );
  });

  it("should store the canonical cpf and start the account as CLIENT", async () => {
    const response = await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "529.982.247-25",
      password: "12345678",
    });

    if (response.isLeft()) throw response.value;

    const user = await inMemoryUsersRepository.findById(response.value.userId);

    expect(user?.cpf).toBe("52998224725");
    expect(user?.role).toBe("CLIENT");
    expect(user?.emailVerified).toBe(false);
  });

  it("should not be able to create a user with an invalid cpf", async () => {
    const response = await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "00000000000",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(InvalidCpfError);
  });

  it("should not be able to create a user with an existing email", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "529.982.247-25",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com",
      cpf: "111.444.777-35",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a user with an existing cpf", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "529.982.247-25",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano2@email.com",
      cpf: "52998224725",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a user with a weak password", async () => {
    const response = await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "123.456.789-09",
      password: "123",
    });

    expect(response.value).toBeInstanceOf(WeakPasswordError);
  });
});
