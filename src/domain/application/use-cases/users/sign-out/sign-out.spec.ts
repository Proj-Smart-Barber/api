import { faker } from "@faker-js/faker";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { FakeAuthGateway } from "../../../../../../test/repositories/fake-auth-gateway";
import { User } from "../../../../enterprise/entities/user";
import { SignOutUseCase } from "./sign-out";

let inMemoryUsersRepository: InMemoryUsersRepository;
let fakeAuthGateway: FakeAuthGateway;
let sut: SignOutUseCase;

async function seedSessions() {
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

  const current = await fakeAuthGateway.signIn({ email, password });
  const other = await fakeAuthGateway.signIn({ email, password });

  return { current, other };
}

describe("Sign out", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    fakeAuthGateway = new FakeAuthGateway(inMemoryUsersRepository);
    sut = new SignOutUseCase(fakeAuthGateway);
  });

  it("should close only the current session by default", async () => {
    const { current, other } = await seedSessions();

    const response = await sut.execute({
      headers: { authorization: `Bearer ${current.token}` },
    });

    expect(response.isRight()).toBe(true);
    await expect(
      fakeAuthGateway.getSession({
        authorization: `Bearer ${current.token}`,
      }),
    ).resolves.toBeNull();
    await expect(
      fakeAuthGateway.getSession({ authorization: `Bearer ${other.token}` }),
    ).resolves.toBeTruthy();
  });

  it("should close every session when logging out of all devices", async () => {
    const { current, other } = await seedSessions();

    const response = await sut.execute({
      headers: { authorization: `Bearer ${current.token}` },
      all: true,
    });

    expect(response.isRight()).toBe(true);
    expect(fakeAuthGateway.activeSessionCount).toBe(0);
    await expect(
      fakeAuthGateway.getSession({ authorization: `Bearer ${other.token}` }),
    ).resolves.toBeNull();
  });

  it("should require a valid session", async () => {
    const response = await sut.execute({ headers: {} });

    expect(response.isLeft()).toBe(true);
  });
});
