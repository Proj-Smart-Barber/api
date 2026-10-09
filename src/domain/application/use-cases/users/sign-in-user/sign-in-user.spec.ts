import { faker } from "@faker-js/faker";
import { InMemoryRefreshTokensRepository } from "../../../../../../test/repositories/in-memory-refresh-tokens-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { User } from "../../../../enterprise/entities/user";
import { SignInUserUseCase } from "./sign-in-user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import { EmailNotVerifiedError } from "../../_errors/email-not-verified-error";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryRefreshTokensRepository: InMemoryRefreshTokensRepository;
let sut: SignInUserUseCase;

describe("Sign in user", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryRefreshTokensRepository = new InMemoryRefreshTokensRepository();
    sut = new SignInUserUseCase(
      inMemoryUsersRepository,
      inMemoryRefreshTokensRepository,
    );
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
      emailVerifiedAt: new Date(),
    });

    await inMemoryUsersRepository.save(newUser);

    const response = await sut.execute({
      email: userEmail,
      password: userPassword,
    });

    expect(response.value).toEqual(
      expect.objectContaining({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
      }),
    );
    expect(inMemoryRefreshTokensRepository.items).toHaveLength(1);
  });

  it("should not be able to sign in a user whose email is not verified", async () => {
    const userEmail = faker.internet.email();
    const userPassword = faker.internet.password();

    const newUser = User.create({
      name: faker.person.fullName(),
      email: userEmail,
      password: await Password.generateHashFromPlainText(userPassword, 12),
      cpf: "12345678902",
    });

    await inMemoryUsersRepository.save(newUser);

    const response = await sut.execute({
      email: userEmail,
      password: userPassword,
    });

    expect(response.value).toBeInstanceOf(EmailNotVerifiedError);
    expect(inMemoryRefreshTokensRepository.items).toHaveLength(0);
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
