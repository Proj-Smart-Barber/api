import { faker } from "@faker-js/faker";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { FakeAuthGateway } from "../../../../../../test/repositories/fake-auth-gateway";
import { User } from "../../../../enterprise/entities/user";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import { RefreshSessionUseCase } from "./refresh-session";
import {
  GESTOR_SESSION_TTL_SECONDS,
  USER_SESSION_TTL_SECONDS,
} from "../../../../../infra/auth/session-expiry";

let inMemoryUsersRepository: InMemoryUsersRepository;
let fakeAuthGateway: FakeAuthGateway;
let sut: RefreshSessionUseCase;

async function seedSession(role: "CLIENT" | "OWNER") {
  const email = faker.internet.email().toLowerCase();
  const password = faker.internet.password({ length: 12 });

  await inMemoryUsersRepository.save(
    User.create({
      name: faker.person.fullName(),
      email,
      cpf: "52998224725",
      role,
    }),
  );
  fakeAuthGateway.registerCredentials(email, password);

  const session = await fakeAuthGateway.signIn({ email, password });

  return session;
}

describe("Refresh session", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    fakeAuthGateway = new FakeAuthGateway(inMemoryUsersRepository);
    sut = new RefreshSessionUseCase(fakeAuthGateway);
  });

  it("should extend a client session for 30 days when the token comes in the body", async () => {
    const session = await seedSession("CLIENT");
    fakeAuthGateway.shrinkSession(session.token, 60);

    const response = await sut.execute({ token: session.token });

    expect(response.isRight()).toBe(true);

    if (response.isRight()) {
      const ttlSeconds = Math.round(
        (response.value.expiresAt.getTime() - Date.now()) / 1000,
      );

      expect(response.value.token).toBe(session.token);
      expect(ttlSeconds).toBeGreaterThan(USER_SESSION_TTL_SECONDS - 60);
    }
  });

  it("should never extend a gestor session beyond 8 hours", async () => {
    const session = await seedSession("OWNER");
    fakeAuthGateway.shrinkSession(session.token, 60);

    const response = await sut.execute({ token: session.token });

    if (response.isLeft()) throw response.value;

    const ttlSeconds = Math.round(
      (response.value.expiresAt.getTime() - Date.now()) / 1000,
    );

    expect(ttlSeconds).toBeLessThanOrEqual(GESTOR_SESSION_TTL_SECONDS);
    expect(ttlSeconds).toBeGreaterThan(GESTOR_SESSION_TTL_SECONDS - 60);
  });

  it("should refresh a web session from the cookie header", async () => {
    const session = await seedSession("CLIENT");

    const response = await sut.execute({
      headers: {
        cookie: `better-auth.session_token=${session.token}`,
      },
    });

    expect(response.isRight()).toBe(true);
  });

  it("should not restore an expired session", async () => {
    const session = await seedSession("CLIENT");
    fakeAuthGateway.expireSession(session.token);

    const response = await sut.execute({ token: session.token });

    // O token estava expirado: a validação falha antes de estender.
    expect(response.value).toBeInstanceOf(UnauthorizedError);
  });

  it("should not refresh an unknown token", async () => {
    const response = await sut.execute({ token: "invalid-token" });

    expect(response.value).toBeInstanceOf(UnauthorizedError);
  });
});
