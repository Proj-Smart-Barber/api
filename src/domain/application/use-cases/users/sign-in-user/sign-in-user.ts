import { type Either, left, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import { TooManyRequestsError } from "../../_errors/too-many-requests-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import type { SignInUserDTO } from "./sign-in-user-dto";
import type { SignInUserResponse } from "./sign-in-user-response";

type SignInUserUseCaseResponse = Either<
  InvalidCredentialsError | UnauthorizedError | TooManyRequestsError,
  SignInUserResponse
>;

/**
 * Login único por e-mail e senha. O tipo (CLIENT/BARBER/OWNER/PLATFORM_ADMIN)
 * vem do servidor — nunca do cliente — e a sessão já nasce com a expiração
 * da política do papel (8h gestor / 30d usuário).
 */
export class SignInUserUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({
    email,
    password,
    callbackURL,
  }: SignInUserDTO): Promise<SignInUserUseCaseResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const session = await this.authGateway.signIn({
        email: normalizedEmail,
        password,
        callbackURL,
      });

      return right({
        access_token: session.token,
        token: session.token,
        user: session.user,
        expiresAt: session.expiresAt,
        setCookies: session.setCookies,
        authToken: session.authToken,
      });
    } catch (error) {
      if (error instanceof AuthGatewayError) {
        switch (error.code) {
          case "INVALID_CREDENTIALS":
            return left(new InvalidCredentialsError());
          case "RATE_LIMITED":
            return left(new TooManyRequestsError());
          case "UNAUTHORIZED":
            return left(new UnauthorizedError());
          default:
            break;
        }
      }

      throw error;
    }
  }
}
