import { type Either, left, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { TooManyRequestsError } from "../../_errors/too-many-requests-error";
import type { RequestPasswordResetDTO } from "./request-password-reset-dto";
import type { RequestPasswordResetResponse } from "./request-password-reset-response";

type RequestPasswordResetUseCaseResponse = Either<
  TooManyRequestsError,
  RequestPasswordResetResponse
>;

/**
 * Solicita recuperação de acesso. O link é expirante (1h) e de uso único, e
 * invalida links anteriores — apenas o último enviado funciona.
 */
export class RequestPasswordResetUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({
    email,
    redirectTo,
  }: RequestPasswordResetDTO): Promise<RequestPasswordResetUseCaseResponse> {
    try {
      await this.authGateway.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo,
      });
    } catch (error) {
      if (error instanceof AuthGatewayError && error.code === "RATE_LIMITED") {
        return left(new TooManyRequestsError());
      }

      throw error;
    }

    return right({
      status: true,
      message: "Se o e-mail existir, você receberá um link de recuperação.",
    });
  }
}
