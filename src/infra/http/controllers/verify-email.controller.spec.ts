import { hashToken } from "../../../core/crypto/token";
import { EmailVerification } from "../../../domain/enterprise/entities/email-verification";
import { User } from "../../../domain/enterprise/entities/user";
import { Password } from "../../../domain/enterprise/entities/value-objects/password";
import { VerifyEmailUseCase } from "../../../domain/application/use-cases/users/verify-email/verify-email";
import { InMemoryEmailVerificationsRepository } from "../../../../test/repositories/in-memory-email-verifications-repository";
import { InMemoryUsersRepository } from "../../../../test/repositories/in-memory-users-repository";
import { VerifyEmailController } from "./verify-email-controller";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEmailVerificationsRepository: InMemoryEmailVerificationsRepository;
let controller: VerifyEmailController;

describe("VerifyEmailController", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEmailVerificationsRepository =
      new InMemoryEmailVerificationsRepository();

    const useCase = new VerifyEmailUseCase(
      inMemoryEmailVerificationsRepository,
      inMemoryUsersRepository,
    );

    controller = new VerifyEmailController(useCase);
  });

  async function createUnverifiedUser(): Promise<User> {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });

    return inMemoryUsersRepository.save(user);
  }

  it("should return 200 with verified=true for a valid token", async () => {
    const user = await createUnverifiedUser();
    const plainToken = "valid-token";

    await inMemoryEmailVerificationsRepository.create(
      EmailVerification.create({
        userId: user.id,
        tokenHash: hashToken(plainToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    const response = await controller.handle({ token: plainToken });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        verified: true,
        alreadyVerified: false,
        userId: user.id.toString(),
        email: "fulano@email.com",
        emailVerifiedAt: expect.any(Date),
      }),
    );

    const updatedUser = await inMemoryUsersRepository.findById(
      user.id.toString(),
    );
    expect(updatedUser?.isEmailVerified).toBe(true);
  });

  it("should return 200 with alreadyVerified=true for a verified user", async () => {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
      emailVerifiedAt: new Date(),
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

    const response = await controller.handle({ token: plainToken });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        verified: true,
        alreadyVerified: true,
        userId: user.id.toString(),
        email: "fulano@email.com",
      }),
    );
  });

  it("should return 400 for an unknown token", async () => {
    await createUnverifiedUser();

    const response = await controller.handle({ token: "unknown-token" });

    expect(response.statusCode).toBe(400);
  });

  it("should return 400 when the token is missing", async () => {
    const response = await controller.handle(
      {} as Parameters<typeof controller.handle>[0],
    );

    expect(response.statusCode).toBe(400);
  });
});
