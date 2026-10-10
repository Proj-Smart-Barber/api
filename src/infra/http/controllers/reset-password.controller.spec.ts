import { hashToken } from "../../../core/crypto/token";
import { PasswordRecoveryToken } from "../../../domain/enterprise/entities/password-recovery-token";
import { User } from "../../../domain/enterprise/entities/user";
import { Password } from "../../../domain/enterprise/entities/value-objects/password";
import { ResetPasswordUseCase } from "../../../domain/application/use-cases/users/reset-password/reset-password";
import { InMemoryPasswordRecoveryTokensRepository } from "../../../../test/repositories/in-memory-password-recovery-tokens-repository";
import { InMemoryRefreshTokensRepository } from "../../../../test/repositories/in-memory-refresh-tokens-repository";
import { InMemoryUsersRepository } from "../../../../test/repositories/in-memory-users-repository";
import { ResetPasswordController } from "./reset-password-controller";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryPasswordRecoveryTokensRepository: InMemoryPasswordRecoveryTokensRepository;
let inMemoryRefreshTokensRepository: InMemoryRefreshTokensRepository;
let controller: ResetPasswordController;

const NOW_IN_MS = Date.now();

describe("ResetPasswordController", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryPasswordRecoveryTokensRepository =
      new InMemoryPasswordRecoveryTokensRepository();
    inMemoryRefreshTokensRepository = new InMemoryRefreshTokensRepository();

    const useCase = new ResetPasswordUseCase(
      inMemoryPasswordRecoveryTokensRepository,
      inMemoryUsersRepository,
      inMemoryRefreshTokensRepository,
    );

    controller = new ResetPasswordController(useCase);
  });

  async function createUserWithRecoveryToken(
    plainToken: string,
  ): Promise<User> {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("senha-antiga", 12),
      cpf: "00000000000",
    });
    await inMemoryUsersRepository.save(user);

    await inMemoryPasswordRecoveryTokensRepository.create(
      PasswordRecoveryToken.create({
        userId: user.id,
        tokenHash: hashToken(plainToken),
        expiresAt: new Date(NOW_IN_MS + 60 * 60 * 1000),
      }),
    );

    return user;
  }

  it("should return 200 with the reset details for a valid token", async () => {
    const user = await createUserWithRecoveryToken("valid-token");

    const response = await controller.handle({
      token: "valid-token",
      newPassword: "nova-senha-forte",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        userId: user.id.toString(),
        email: "fulano@email.com",
        passwordUpdatedAt: expect.any(Date),
      }),
    );
  });

  it("should return 400 for an invalid token", async () => {
    await createUserWithRecoveryToken("valid-token");

    const response = await controller.handle({
      token: "unknown-token",
      newPassword: "nova-senha-forte",
    });

    expect(response.statusCode).toBe(400);
  });

  it("should return 400 for a weak password", async () => {
    await createUserWithRecoveryToken("valid-token");

    const response = await controller.handle({
      token: "valid-token",
      newPassword: "1234567",
    });

    expect(response.statusCode).toBe(400);
  });

  it("should return 400 when the token is missing", async () => {
    const response = await controller.handle({
      newPassword: "nova-senha-forte",
    } as Parameters<typeof controller.handle>[0]);

    expect(response.statusCode).toBe(400);
  });
});
