import { type Either, left, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { InvalidTokenError } from "../../_errors/invalid-token-error";
import { WeakPasswordError } from "../../_errors/weak-password-error";
import type { ConfirmPasswordResetDTO } from "./confirm-password-reset-dto";
import type { ConfirmPasswordResetResponse } from "./confirm-password-reset-response";

type ConfirmPasswordResetUseCaseResponse = Either<
  InvalidTokenError | WeakPasswordError,
  ConfirmPasswordResetResponse
>;

/**
 * Redefine a senha com token expirante/de uso único. Ao concluir, todas as
 * sessões ativas do usuário são revogadas (configuração do better-auth).
 */
export class ConfirmPasswordResetUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({
    token,
    newPassword,
  }: ConfirmPasswordResetDTO): Promise<ConfirmPasswordResetUseCaseResponse> {
    try {
      await this.authGateway.confirmPasswordReset({ token, newPassword });
    } catch (error) {
      if (error instanceof AuthGatewayError) {
        if (error.code === "INVALID_TOKEN" || error.code === "UNAUTHORIZED") {
          return left(new InvalidTokenError());
        }

        if (
          error.code === "WEAK_PASSWORD" ||
          error.code === "INVALID_PASSWORD"
        ) {
          return left(new WeakPasswordError());
        }
      }

      throw error;
    }

    return right({
      status: true,
      message: "Senha redefinida. As sessões anteriores foram encerradas.",
    });
  }
}
