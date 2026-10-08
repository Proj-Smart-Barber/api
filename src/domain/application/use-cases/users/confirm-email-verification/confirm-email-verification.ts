import { type Either, left, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { InvalidTokenError } from "../../_errors/invalid-token-error";
import type { ConfirmEmailVerificationDTO } from "./confirm-email-verification-dto";
import type { ConfirmEmailVerificationResponse } from "./confirm-email-verification-response";

type ConfirmEmailVerificationUseCaseResponse = Either<
  InvalidTokenError,
  ConfirmEmailVerificationResponse
>;

/** Confirma o e-mail com token expirante e de uso único. */
export class ConfirmEmailVerificationUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({
    token,
    callbackURL,
  }: ConfirmEmailVerificationDTO): Promise<ConfirmEmailVerificationUseCaseResponse> {
    try {
      await this.authGateway.confirmEmailVerification({
        token,
        callbackURL,
      });

      return right({ status: true });
    } catch (error) {
      if (
        error instanceof AuthGatewayError &&
        (error.code === "INVALID_TOKEN" || error.code === "UNAUTHORIZED")
      ) {
        return left(new InvalidTokenError());
      }

      throw error;
    }
  }
}
