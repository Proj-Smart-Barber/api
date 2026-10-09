import { hashToken } from "../../../../../core/crypto/token";
import { EmailVerification } from "../../../../enterprise/entities/email-verification";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InMemoryEmailVerificationsRepository } from "../../../../../../test/repositories/in-memory-email-verifications-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { InvalidVerificationTokenError } from "../../_errors/invalid-verification-token-error";
import { VerifyEmailUseCase } from "./verify-email";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEmailVerificationsRepository: InMemoryEmailVerificationsRepository;
let sut: VerifyEmailUseCase;

describe("Verify email", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEmailVerificationsRepository =
      new InMemoryEmailVerificationsRepository();

    sut = new VerifyEmailUseCase(
      inMemoryEmailVerificationsRepository,
      inMemoryUsersRepository,
    );
  });

  async function createUnverifiedUser(): Promise<User> {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });
    await inMemoryUsersRepository.save(user);

    return user;
  }

  it("should verify the email of an unverified user with a valid token", async () => {
    const user = await createUnverifiedUser();
    const plainToken = "valid-random-token";

    await inMemoryEmailVerificationsRepository.create(
      EmailVerification.create({
        userId: user.id,
        tokenHash: hashToken(plainToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    const response = await sut.execute({ token: plainToken });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual(
      expect.objectContaining({
        userId: user.id.toString(),
        email: "fulano@email.com",
        emailVerifiedAt: expect.any(Date),
        alreadyVerified: false,
      }),
    );

    const updatedUser = await inMemoryUsersRepository.findById(
      user.id.toString(),
    );
    expect(updatedUser?.isEmailVerified).toBe(true);
    expect(inMemoryEmailVerificationsRepository.items[0].isUsed()).toBe(true);
  });

  it("should not verify with an unknown token", async () => {
    const user = await createUnverifiedUser();

    const response = await sut.execute({ token: "unknown-token" });

    expect(response.value).toBeInstanceOf(InvalidVerificationTokenError);
    const updatedUser = await inMemoryUsersRepository.findById(
      user.id.toString(),
    );
    expect(updatedUser?.isEmailVerified).toBe(false);
  });

  it("should not verify with an expired token", async () => {
    const user = await createUnverifiedUser();
    const plainToken = "expired-token";

    await inMemoryEmailVerificationsRepository.create(
      EmailVerification.create({
        userId: user.id,
        tokenHash: hashToken(plainToken),
        expiresAt: new Date(Date.now() - 1000),
      }),
    );

    const response = await sut.execute({ token: plainToken });

    expect(response.value).toBeInstanceOf(InvalidVerificationTokenError);
  });

  it("should return success for an already verified user", async () => {
    const emailVerifiedAt = new Date();
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
      emailVerifiedAt,
    });
    await inMemoryUsersRepository.save(user);
    const plainToken = "valid-token";

    await inMemoryEmailVerificationsRepository.create(
      EmailVerification.create({
        userId: user.id,
        tokenHash: hashToken(plainToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    const response = await sut.execute({ token: plainToken });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual(
      expect.objectContaining({
        userId: user.id.toString(),
        email: "fulano@email.com",
        emailVerifiedAt,
        alreadyVerified: true,
      }),
    );

    const updatedUser = await inMemoryUsersRepository.findById(
      user.id.toString(),
    );
    expect(updatedUser?.isEmailVerified).toBe(true);
    expect(inMemoryEmailVerificationsRepository.items[0].isUsed()).toBe(false);
  });

  it("should return success for an already verified user even with an expired token", async () => {
    const emailVerifiedAt = new Date();
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
      emailVerifiedAt,
    });
    await inMemoryUsersRepository.save(user);
    const plainToken = "expired-token";

    await inMemoryEmailVerificationsRepository.create(
      EmailVerification.create({
        userId: user.id,
        tokenHash: hashToken(plainToken),
        expiresAt: new Date(Date.now() - 1000),
      }),
    );

    const response = await sut.execute({ token: plainToken });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual(
      expect.objectContaining({
        userId: user.id.toString(),
        email: "fulano@email.com",
        emailVerifiedAt,
        alreadyVerified: true,
      }),
    );
  });

  it("should not mark a used token as verified for an unverified user", async () => {
    const user = await createUnverifiedUser();
    const plainToken = "used-token";
    const verification = EmailVerification.create({
      userId: user.id,
      tokenHash: hashToken(plainToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    verification.markAsUsed();
    await inMemoryEmailVerificationsRepository.create(verification);

    const response = await sut.execute({ token: plainToken });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidVerificationTokenError);
  });
});
