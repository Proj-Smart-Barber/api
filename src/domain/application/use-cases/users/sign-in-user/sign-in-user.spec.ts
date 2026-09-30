import { faker } from "@faker-js/faker";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { User } from "../../../../enterprise/entities/user";
import { SignInUserUseCase } from "./sign-in-user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: SignInUserUseCase;

describe("Sign in user", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    sut = new SignInUserUseCase(
      inMemoryUsersRepository,
      inMemoryBarbershopsRepository,
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
    });

    const createdUser = await inMemoryUsersRepository.save(newUser);

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Test",
        ownerId: createdUser.id,
        timezone: "America/Sao_Paulo",
        slug: Slug.create("barbearia-test"),
        cnpj: "12345678000190",
        location: "Rua X, 123",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-1"),
    );

    inMemoryBarbershopsRepository.items.push(barbershop);
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: barbershop.id,
        userId: createdUser.id,
        role: Role.OWNER,
      }),
    );

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

    const createdUser = await inMemoryUsersRepository.save(newUser);

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Test",
        ownerId: createdUser.id,
        timezone: "America/Sao_Paulo",
        slug: Slug.create("barbearia-test"),
        cnpj: "12345678000190",
        location: "Rua X, 123",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-1"),
    );

    inMemoryBarbershopsRepository.items.push(barbershop);
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: barbershop.id,
        userId: createdUser.id,
        role: Role.OWNER,
      }),
    );

    const response = await sut.execute({
      email: userEmail,
      password: "wrong-password",
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });

  it("should not be able to sign in a user without memberships", async () => {
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
      password: userPassword,
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });
});
