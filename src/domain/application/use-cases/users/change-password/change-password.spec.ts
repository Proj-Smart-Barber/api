import { faker } from "@faker-js/faker";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { FakeAuthGateway } from "../../../../../../test/repositories/fake-auth-gateway";
import { User } from "../../../../enterprise/entities/user";
import { InvalidPasswordError } from "../../_errors/invalid-password-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import { WeakPasswordError } from "../../_errors/weak-password-error";
import { ChangePasswordUseCase } from "./change-password";

let inMemoryUsersRepository: InMemoryUsersRepository;
let fakeAuthGateway: FakeAuthGateway;
let sut: ChangePasswordUseCase;

const currentPassword = "CurrentPass123!";
const newPassword = "NewSecretPass456!";

async function seedAuthenticatedUser() {
  const email = faker.internet.email().toLowerCase();

  const user = await inMemoryUsersRepository.save(
    User.create({
      name: faker.person.fullName(),
      email,
      cpf: "52998224725",
      role: "CLIENT",
    }),
  );

  fakeAuthGateway.registerCredentials(email, currentPassword);

  const session = await fakeAuthGateway.signIn({
    email,
    password: currentPassword,
  });

  return { user, session };
}

describe("Change password", async () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    fakeAuthGateway = new FakeAuthGateway(inMemoryUsersRepository);
    sut = new ChangePasswordUseCase(fakeAuthGateway);
  });

  it("should be able to change the password of the authenticated session", async () => {
    const { session } = await seedAuthenticatedUser();

    const response = await sut.execute({
      userId: session.user.id,
      headers: { authorization: `Bearer ${session.token}` },
      currentPassword,
      newPassword,
    });

    expect(response.isRight()).toBe(true);

    // A nova senha passa a valer; a antiga, não.
    await expect(
      fakeAuthGateway.signIn({
        email: session.user.email,
        password: newPassword,
      }),
    ).resolves.toBeTruthy();
    await expect(
      fakeAuthGateway.signIn({
        email: session.user.email,
        password: currentPassword,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("should revoke the other sessions and pending reset links", async () => {
    const { user, session } = await seedAuthenticatedUser();

    const otherSession = await fakeAuthGateway.signIn({
      email: session.user.email,
      password: currentPassword,
    });

    await fakeAuthGateway.requestPasswordReset({ email: session.user.email });

    expect(fakeAuthGateway.activeSessionCount).toBe(2);
    expect(fakeAuthGateway.pendingPasswordResetCount).toBe(1);

    const response = await sut.execute({
      userId: user.id.toString(),
      headers: { authorization: `Bearer ${session.token}` },
      currentPassword,
      newPassword,
    });

    expect(response.isRight()).toBe(true);
    expect(fakeAuthGateway.activeSessionCount).toBe(1);
    expect(fakeAuthGateway.pendingPasswordResetCount).toBe(0);

    // A sessão antiga (outro dispositivo) não autentica mais.
    await expect(
      fakeAuthGateway.getSession({
        authorization: `Bearer ${otherSession.token}`,
      }),
    ).resolves.toBeNull();
  });

  it("should not be able to change the password without a session", async () => {
    const response = await sut.execute({
      userId: faker.string.uuid(),
      currentPassword,
      newPassword,
    });

    expect(response.value).toBeInstanceOf(UnauthorizedError);
  });

  it("should not be able to change the password with the wrong current password", async () => {
    const { session } = await seedAuthenticatedUser();

    const response = await sut.execute({
      userId: session.user.id,
      headers: { authorization: `Bearer ${session.token}` },
      currentPassword: "WrongPassword123!",
      newPassword,
    });

    expect(response.value).toBeInstanceOf(InvalidPasswordError);
  });

  it("should not accept a weak new password", async () => {
    const { session } = await seedAuthenticatedUser();

    const response = await sut.execute({
      userId: session.user.id,
      headers: { authorization: `Bearer ${session.token}` },
      currentPassword,
      newPassword: "123",
    });

    expect(response.value).toBeInstanceOf(WeakPasswordError);
  });
});
