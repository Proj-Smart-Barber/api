import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { hashToken } from "../../../../../core/crypto/token";
import { PasswordRecoveryToken } from "../../../../enterprise/entities/password-recovery-token";
import { RefreshToken } from "../../../../enterprise/entities/refresh-token";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InMemoryPasswordRecoveryTokensRepository } from "../../../../../../test/repositories/in-memory-password-recovery-tokens-repository";
import { InMemoryRefreshTokensRepository } from "../../../../../../test/repositories/in-memory-refresh-tokens-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { InvalidPasswordRecoveryTokenError } from "../../_errors/invalid-password-recovery-token-error";
import { WeakPasswordError } from "../../_errors/weak-password-error";
import { ResetPasswordUseCase } from "./reset-password";

const NOW_IN_MS = Date.now();
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryPasswordRecoveryTokensRepository: InMemoryPasswordRecoveryTokensRepository;
let inMemoryRefreshTokensRepository: InMemoryRefreshTokensRepository;
let sut: ResetPasswordUseCase;

describe("Reset password", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryPasswordRecoveryTokensRepository =
      new InMemoryPasswordRecoveryTokensRepository();
    inMemoryRefreshTokensRepository = new InMemoryRefreshTokensRepository();

    sut = new ResetPasswordUseCase(
      inMemoryPasswordRecoveryTokensRepository,
      inMemoryUsersRepository,
      inMemoryRefreshTokensRepository,
    );
  });

  async function createUserWithRecoveryToken(
    plainToken: string,
    tokenExpiresInMs = ONE_HOUR_IN_MS,
  ): Promise<{ user: User; plainToken: string }> {
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
        expiresAt: new Date(NOW_IN_MS + tokenExpiresInMs),
      }),
    );

    return { user, plainToken };
  }

  it("should reset the password and mark the token as used", async () => {
    const { user, plainToken } = await createUserWithRecoveryToken(
      "valid-recovery-token",
    );

    const response = await sut.execute({
      token: plainToken,
      newPassword: "nova-senha-forte",
    });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual(
      expect.objectContaining({
        userId: user.id.toString(),
        email: "fulano@email.com",
        passwordUpdatedAt: expect.any(Date),
      }),
    );

    const updatedUser = await inMemoryUsersRepository.findById(
      user.id.toString(),
    );
    expect(updatedUser).not.toBeNull();
    expect(
      (
        await Password.isValid(
          "nova-senha-forte",
          updatedUser?.password.value ?? "",
        )
      ).isRight(),
    ).toBe(true);
    expect(
      (
        await Password.isValid(
          "senha-antiga",
          updatedUser?.password.value ?? "",
        )
      ).isLeft(),
    ).toBe(true);

    const token =
      await inMemoryPasswordRecoveryTokensRepository.findByTokenHash(
        hashToken(plainToken),
      );
    expect(token?.isUsed()).toBe(true);
  });

  it("should invalidate other active recovery tokens after a successful reset", async () => {
    const { user, plainToken } = await createUserWithRecoveryToken(
      "valid-recovery-token",
    );

    const otherToken = PasswordRecoveryToken.create({
      userId: user.id,
      tokenHash: "other-token-hash",
      expiresAt: new Date(NOW_IN_MS + ONE_HOUR_IN_MS),
    });
    await inMemoryPasswordRecoveryTokensRepository.create(otherToken);

    await sut.execute({
      token: plainToken,
      newPassword: "nova-senha-forte",
    });

    expect(otherToken.isUsed()).toBe(true);
  });

  it("should revoke all refresh tokens after a successful reset", async () => {
    const { user, plainToken } = await createUserWithRecoveryToken(
      "valid-recovery-token",
    );

    const refreshToken = RefreshToken.create({
      userId: user.id,
      tokenHash: "refresh-token-hash",
      familyId: new UniqueEntityId(),
      expiresAt: new Date(NOW_IN_MS + ONE_HOUR_IN_MS),
    });
    await inMemoryRefreshTokensRepository.create(refreshToken);

    await sut.execute({
      token: plainToken,
      newPassword: "nova-senha-forte",
    });

    expect(refreshToken.isRevoked()).toBe(true);
  });

  it("should not reset with an unknown token", async () => {
    const { user } = await createUserWithRecoveryToken("valid-recovery-token");

    const response = await sut.execute({
      token: "unknown-token",
      newPassword: "nova-senha-forte",
    });

    expect(response.value).toBeInstanceOf(InvalidPasswordRecoveryTokenError);

    const updatedUser = await inMemoryUsersRepository.findById(
      user.id.toString(),
    );
    expect(
      (
        await Password.isValid(
          "senha-antiga",
          updatedUser?.password.value ?? "",
        )
      ).isRight(),
    ).toBe(true);
  });

  it("should not reset with an expired token", async () => {
    const { plainToken } = await createUserWithRecoveryToken(
      "expired-token",
      -1000,
    );

    const response = await sut.execute({
      token: plainToken,
      newPassword: "nova-senha-forte",
    });

    expect(response.value).toBeInstanceOf(InvalidPasswordRecoveryTokenError);
  });

  it("should not reset with an already used token", async () => {
    const { user, plainToken } =
      await createUserWithRecoveryToken("used-token");

    const token =
      await inMemoryPasswordRecoveryTokensRepository.findByTokenHash(
        hashToken(plainToken),
      );
    expect(token).not.toBeNull();
    token?.markAsUsed();
    if (token) {
      await inMemoryPasswordRecoveryTokensRepository.save(token);
    }

    const response = await sut.execute({
      token: plainToken,
      newPassword: "nova-senha-forte",
    });

    expect(response.value).toBeInstanceOf(InvalidPasswordRecoveryTokenError);

    const updatedUser = await inMemoryUsersRepository.findById(
      user.id.toString(),
    );
    expect(
      (
        await Password.isValid(
          "senha-antiga",
          updatedUser?.password.value ?? "",
        )
      ).isRight(),
    ).toBe(true);
  });

  it("should not reset with a weak password and keep the token usable", async () => {
    const { plainToken } = await createUserWithRecoveryToken(
      "valid-recovery-token",
    );

    const response = await sut.execute({
      token: plainToken,
      newPassword: "1234567",
    });

    expect(response.value).toBeInstanceOf(WeakPasswordError);

    const token =
      await inMemoryPasswordRecoveryTokensRepository.findByTokenHash(
        hashToken(plainToken),
      );
    expect(token?.isUsed()).toBe(false);
  });
});
