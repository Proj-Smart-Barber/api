import { InMemoryUsersRepository } from "../../../../test/repositories/in-memory-users-repository";
import { CreateUserUseCase } from "../../../domain/application/use-cases/users/create-user/create-user";
import { CreateUserController } from "./create-user-controller";

let usersRepository: InMemoryUsersRepository;
let controller: CreateUserController;

describe("CreateUserController", () => {
  beforeEach(() => {
    usersRepository = new InMemoryUsersRepository();
    const useCase = new CreateUserUseCase(usersRepository);
    controller = new CreateUserController(useCase);
  });

  it("should create a user with a formatted cpf and store only the digits", async () => {
    const response = await controller.handle({
      name: "Fulano",
      email: "fulano@email.com",
      password: "12345678",
      cpf: "111.444.777-35",
    });

    expect(response.statusCode).toBe(201);

    const created = await usersRepository.findByEmail("fulano@email.com");

    expect(created?.cpf).toBe("11144477735");
  });

  it("should create a user with an unformatted cpf", async () => {
    const response = await controller.handle({
      name: "Fulano",
      email: "fulano@email.com",
      password: "12345678",
      cpf: "11144477735",
    });

    expect(response.statusCode).toBe(201);
  });

  it("should reject an invalid cpf with 400", async () => {
    const response = await controller.handle({
      name: "Fulano",
      email: "fulano@email.com",
      password: "12345678",
      cpf: "00000000000",
    });

    expect(response.statusCode).toBe(400);
    expect(await usersRepository.findByEmail("fulano@email.com")).toBeNull();
  });
});
