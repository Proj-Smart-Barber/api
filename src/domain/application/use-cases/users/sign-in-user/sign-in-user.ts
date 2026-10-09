import { type Either, left, right } from "../../../../../core/logic/either";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { RefreshTokensRepository } from "../../../repositories/refresh-tokens-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import {
  createAccessToken,
  createRefreshToken,
} from "../../../services/auth-token-service";
import { EmailNotVerifiedError } from "../../_errors/email-not-verified-error";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import type { SignInUserDTO } from "./sign-in-user-dto";
import type { SignInUserResponse } from "./sign-in-user-response";

type SignInUserUseCaseResponse = Either<
  InvalidCredentialsError | EmailNotVerifiedError,
  SignInUserResponse
>;

export class SignInUserUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute({
    email,
    password,
  }: SignInUserDTO): Promise<SignInUserUseCaseResponse> {
    const user = await this.usersRepository.findByEmail(email);

    if (!user) {
      return left(new InvalidCredentialsError());
    }

    const passwordMatch = await Password.isValid(
      password,
      user.password.toString(),
    );

    if (passwordMatch.isLeft()) {
      return left(new InvalidCredentialsError());
    }

    if (!user.isEmailVerified) {
      return left(new EmailNotVerifiedError());
    }

    const userId = user.id.toString();
    const access_token = createAccessToken(userId);
    const { plainToken, refreshToken } = createRefreshToken(userId);

    await this.refreshTokensRepository.create(refreshToken);

    return right({
      access_token,
      refresh_token: plainToken,
    });
  }
}
