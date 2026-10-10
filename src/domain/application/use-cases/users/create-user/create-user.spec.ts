import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { InvalidCpfError } from "../../../../enterprise/errors/invalid-cpf-error";
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
      cpf: "11144477735",
      password: "12345678",
    });

    expect(response.value).toEqual(
      expect.objectContaining({ userId: expect.any(String) }),
    );
  });

  it("should store the cpf without formatting", async () => {
    await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "111.444.777-35",
      password: "12345678",
    });

    const created =
      await inMemoryUsersRepository.findByEmail("fulano@email.com");

    expect(created?.cpf).toBe("11144477735");
  });

  it("should not be able to create a user with an invalid cpf", async () => {
    const response = await sut.execute({
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "12345678900",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(InvalidCpfError);
  });

  it("should not be able to create a user with an existing email", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "11144477735",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com",
      cpf: "52998224725",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should normalize the email to lowercase when creating a user", async () => {
    await sut.execute({
      name: "Fulano",
      email: "  Fulano@Email.COM ",
      cpf: "11144477735",
      password: "12345678",
    });

    const created =
      await inMemoryUsersRepository.findByEmail("fulano@email.com");

    expect(created).not.toBeNull();
    expect(created?.email).toBe("fulano@email.com");
  });

  it("should not be able to create a user with an existing email in a different case", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "Fulano1@Email.com",
      cpf: "11144477735",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com",
      cpf: "52998224725",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a user with an existing cpf", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "11144477735",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano2@email.com",
      cpf: "111.444.777-35",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });

  it("should not be able to create a user with an existing cpf or email", async () => {
    await sut.execute({
      name: "Fulano 1",
      email: "fulano1@email.com",
      cpf: "11144477735",
      password: "12345678",
    });

    const response = await sut.execute({
      name: "Fulano 2",
      email: "fulano1@email.com",
      cpf: "11144477735",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(CPFOrEmailAlreadyInUseError);
  });
});
