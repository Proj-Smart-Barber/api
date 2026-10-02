import { faker } from "@faker-js/faker";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { User } from "../../../../enterprise/entities/user";
import { SignInUserUseCase } from "./sign-in-user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";

let inMemoryUsersRepository: InMemoryUsersRepository;
let sut: SignInUserUseCase;

describe("Sign in user", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    sut = new SignInUserUseCase(inMemoryUsersRepository);
  });

  it("should be able to sign in a user with an email and password", async () => {
    const userEmail = faker.internet.email();
    const userPassword = faker.internet.password();
    const hashedUserPassword = await Password.generateHashFromPlainText(
      userPassword,
      12,
    );

    const newUser = User.create({
      name: faker.person.fullName(),
      email: userEmail,
      password: hashedUserPassword,
      cpf: "12345678901",
    });

    await inMemoryUsersRepository.save(newUser);

    const response = await sut.execute({
      email: userEmail,
      password: userPassword,
    });

    expect(response.value).toEqual(
      expect.objectContaining({ access_token: expect.any(String) }),
    );
  });

  it("should not be able to sign in a user with an invalid email", async () => {
    const userPassword = faker.internet.password();
    const userEmail = faker.internet.email();

    const newUser = User.create({
      name: faker.person.fullName(),
      email: "wrong@email.com",
      password: Password.create(userPassword),
      cpf: "09876543211",
    });

    await inMemoryUsersRepository.save(newUser);

    const response = await sut.execute({
      email: userEmail,
      password: userPassword,
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });

  it("should not be able to sign in a user with an invalid password", async () => {
    const userPassword = faker.internet.password();
    const userEmail = faker.internet.email();

    const newUser = User.create({
      name: faker.person.fullName(),
      email: userEmail,
      password: Password.create(userPassword),
      cpf: "09876543211",
    });

    await inMemoryUsersRepository.save(newUser);

    const response = await sut.execute({
      email: userEmail,
      password: "wrong-password",
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });
});
