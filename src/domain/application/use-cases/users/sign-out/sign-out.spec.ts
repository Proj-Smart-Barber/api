import { hashToken } from "../../../../../core/crypto/token";
import { InMemoryRefreshTokensRepository } from "../../../../../../test/repositories/in-memory-refresh-tokens-repository";
import { createRefreshToken } from "../../../services/auth-token-service";
import { SignOutUseCase } from "./sign-out";

let inMemoryRefreshTokensRepository: InMemoryRefreshTokensRepository;
let sut: SignOutUseCase;

const userId = "11111111-1111-4111-8111-111111111111";

describe("Sign out", async () => {
  beforeEach(() => {
    inMemoryRefreshTokensRepository = new InMemoryRefreshTokensRepository();
    sut = new SignOutUseCase(inMemoryRefreshTokensRepository);
  });

  it("should revoke the given refresh token", async () => {
    const { plainToken, refreshToken } = createRefreshToken(userId);
    await inMemoryRefreshTokensRepository.create(refreshToken);

    await sut.execute({ refresh_token: plainToken });

    const storedToken = await inMemoryRefreshTokensRepository.findByTokenHash(
      hashToken(plainToken),
    );

    expect(storedToken?.isRevoked()).toBe(true);
  });

  it("should be idempotent for unknown tokens", async () => {
    await expect(
      sut.execute({ refresh_token: "unknown-token" }),
    ).resolves.toBeUndefined();
  });

  it("should be idempotent for already revoked tokens", async () => {
    const { plainToken, refreshToken } = createRefreshToken(userId);
    refreshToken.revoke();
    await inMemoryRefreshTokensRepository.create(refreshToken);

    await expect(
      sut.execute({ refresh_token: plainToken }),
    ).resolves.toBeUndefined();
  });
});
