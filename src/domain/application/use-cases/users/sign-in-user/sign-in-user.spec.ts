import { faker } from "@faker-js/faker";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { FakeAuthGateway } from "../../../../../../test/repositories/fake-auth-gateway";
import { User } from "../../../../enterprise/entities/user";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import { SignInUserUseCase } from "./sign-in-user";
import {
  GESTOR_SESSION_TTL_SECONDS,
  USER_SESSION_TTL_SECONDS,
} from "../../../../../infra/auth/session-expiry";

let inMemoryUsersRepository: InMemoryUsersRepository;
let fakeAuthGateway: FakeAuthGateway;
let sut: SignInUserUseCase;

describe("Sign in user", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    fakeAuthGateway = new FakeAuthGateway(inMemoryUsersRepository);
    sut = new SignInUserUseCase(fakeAuthGateway);
  });

  it("should be able to sign in a user with an email and password", async () => {
    const email = faker.internet.email().toLowerCase();
    const password = faker.internet.password({ length: 12 });

    const newUser = User.create({
      name: faker.person.fullName(),
      email,
      cpf: "52998224725",
      role: "CLIENT",
    });

    await inMemoryUsersRepository.save(newUser);
    fakeAuthGateway.registerCredentials(email, password);

    const response = await sut.execute({ email, password });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual(
      expect.objectContaining({
        access_token: expect.any(String),
        token: expect.any(String),
        user: expect.objectContaining({ role: "CLIENT" }),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it("should return a 30 days session for a CLIENT", async () => {
    const email = faker.internet.email().toLowerCase();
    const password = faker.internet.password({ length: 12 });

    await inMemoryUsersRepository.save(
      User.create({
        name: faker.person.fullName(),
        email,
        cpf: "11144477735",
        role: "CLIENT",
      }),
    );
    fakeAuthGateway.registerCredentials(email, password);

    const response = await sut.execute({ email, password });

    if (response.isLeft()) throw response.value;

    const ttlSeconds = Math.round(
      (response.value.expiresAt.getTime() - Date.now()) / 1000,
    );

    expect(ttlSeconds).toBeLessThanOrEqual(USER_SESSION_TTL_SECONDS);
    expect(ttlSeconds).toBeGreaterThan(USER_SESSION_TTL_SECONDS - 60);
  });

  it("should return an 8 hours session for a gestor (OWNER)", async () => {
    const email = faker.internet.email().toLowerCase();
    const password = faker.internet.password({ length: 12 });

    await inMemoryUsersRepository.save(
      User.create({
        name: faker.person.fullName(),
        email,
        cpf: "12345678909",
        role: "OWNER",
      }),
    );
    fakeAuthGateway.registerCredentials(email, password);

    const response = await sut.execute({ email, password });

    if (response.isLeft()) throw response.value;

    const ttlSeconds = Math.round(
      (response.value.expiresAt.getTime() - Date.now()) / 1000,
    );

    expect(ttlSeconds).toBeLessThanOrEqual(GESTOR_SESSION_TTL_SECONDS);
    expect(ttlSeconds).toBeGreaterThan(GESTOR_SESSION_TTL_SECONDS - 60);
  });

  it("should not be able to sign in with an unknown email", async () => {
    const response = await sut.execute({
      email: "unknown@email.com",
      password: "12345678",
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });

  it("should not be able to sign in with an invalid password", async () => {
    const email = faker.internet.email().toLowerCase();
    const password = faker.internet.password({ length: 12 });

    await inMemoryUsersRepository.save(
      User.create({
        name: faker.person.fullName(),
        email,
        cpf: "52998224725",
        role: "CLIENT",
      }),
    );
    fakeAuthGateway.registerCredentials(email, password);

    const response = await sut.execute({
      email,
      password: "wrong-password",
    });

    expect(response.value).toBeInstanceOf(InvalidCredentialsError);
  });
});
