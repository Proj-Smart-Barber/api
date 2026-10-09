import { hashToken } from "../../../../../core/crypto/token";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryRefreshTokensRepository } from "../../../../../../test/repositories/in-memory-refresh-tokens-repository";
import { RefreshToken } from "../../../../enterprise/entities/refresh-token";
import { createRefreshToken } from "../../../services/auth-token-service";
import { InvalidRefreshTokenError } from "../../_errors/invalid-refresh-token-error";
import { RefreshSessionUseCase } from "./refresh-session";

let inMemoryRefreshTokensRepository: InMemoryRefreshTokensRepository;
let sut: RefreshSessionUseCase;

const userId = "11111111-1111-4111-8111-111111111111";

describe("Refresh session", async () => {
  beforeEach(() => {
    inMemoryRefreshTokensRepository = new InMemoryRefreshTokensRepository();
    sut = new RefreshSessionUseCase(inMemoryRefreshTokensRepository);
  });

  async function seedRefreshToken(familyId?: string) {
    const { plainToken, refreshToken } = createRefreshToken(userId, familyId);
    await inMemoryRefreshTokensRepository.create(refreshToken);

    return { plainToken, refreshToken };
  }

  it("should rotate the refresh token and issue a new access token", async () => {
    const { plainToken } = await seedRefreshToken();

    const response = await sut.execute({ refresh_token: plainToken });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual(
      expect.objectContaining({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
      }),
    );

    const rotatedToken = await inMemoryRefreshTokensRepository.findByTokenHash(
      hashToken(plainToken),
    );

    expect(rotatedToken?.isRevoked()).toBe(true);
    expect(rotatedToken?.replacedByTokenId).toBeTruthy();
    expect(inMemoryRefreshTokensRepository.items).toHaveLength(2);
  });

  it("should keep the new token in the same rotation family", async () => {
    const { plainToken, refreshToken } = await seedRefreshToken();

    const response = await sut.execute({ refresh_token: plainToken });

    expect(response.isRight()).toBe(true);

    if (response.isRight()) {
      const newStored = await inMemoryRefreshTokensRepository.findByTokenHash(
        hashToken(response.value.refresh_token),
      );

      expect(newStored?.familyId.toString()).toBe(
        refreshToken.familyId.toString(),
      );
    }
  });

  it("should not refresh with an unknown token", async () => {
    const response = await sut.execute({ refresh_token: "unknown-token" });

    expect(response.value).toBeInstanceOf(InvalidRefreshTokenError);
  });

  it("should revoke the whole family when a revoked token is reused", async () => {
    const { plainToken } = await seedRefreshToken();

    const firstResponse = await sut.execute({ refresh_token: plainToken });
    expect(firstResponse.isRight()).toBe(true);

    if (!firstResponse.isRight()) {
      return;
    }

    const newToken = firstResponse.value.refresh_token;

    const reuseResponse = await sut.execute({ refresh_token: plainToken });
    expect(reuseResponse.value).toBeInstanceOf(InvalidRefreshTokenError);

    expect(inMemoryRefreshTokensRepository.items).toHaveLength(2);
    for (const item of inMemoryRefreshTokensRepository.items) {
      expect(item.isRevoked()).toBe(true);
    }

    const newStored = await inMemoryRefreshTokensRepository.findByTokenHash(
      hashToken(newToken),
    );
    expect(newStored?.isRevoked()).toBe(true);
  });

  it("should not refresh with an expired token", async () => {
    const expiredToken = RefreshToken.create({
      userId: new UniqueEntityId(userId),
      tokenHash: hashToken("expired-token"),
      familyId: new UniqueEntityId(),
      expiresAt: new Date(Date.now() - 1000),
    });

    await inMemoryRefreshTokensRepository.create(expiredToken);

    const response = await sut.execute({ refresh_token: "expired-token" });

    expect(response.value).toBeInstanceOf(InvalidRefreshTokenError);
    expect(expiredToken.isRevoked()).toBe(true);
  });
});
