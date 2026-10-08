import { type Either, left, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { InvalidPasswordError } from "../../_errors/invalid-password-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import { WeakPasswordError } from "../../_errors/weak-password-error";
import type { ChangePasswordDTO } from "./change-password-dto";
import type { ChangePasswordResponse } from "./change-password-response";

type ChangePasswordUseCaseResponse = Either<
  UnauthorizedError | InvalidPasswordError | WeakPasswordError,
  ChangePasswordResponse
>;

/**
 * Troca de senha autenticada. O better-auth revoga todas as sessões antigas e
 * emite uma nova para o dispositivo atual (repassada em `set-auth-token`/
 * `Set-Cookie`); além disso invalidamos os links de recuperação pendentes.
 */
export class ChangePasswordUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({
    headers,
    currentPassword,
    newPassword,
  }: ChangePasswordDTO): Promise<ChangePasswordUseCaseResponse> {
    if (!headers) {
      return left(new UnauthorizedError("Sessão inválida ou expirada."));
    }

    try {
      const relay = await this.authGateway.changePassword({
        headers,
        currentPassword,
        newPassword,
      });

      return right({
        status: true,
        message: "Senha alterada. Todas as sessões antigas foram encerradas.",
        ...relay,
      });
    } catch (error) {
      if (error instanceof AuthGatewayError) {
        switch (error.code) {
          case "UNAUTHORIZED":
            return left(new UnauthorizedError("Sessão inválida ou expirada."));
          case "INVALID_PASSWORD":
            return left(new InvalidPasswordError());
          case "WEAK_PASSWORD":
            return left(new WeakPasswordError());
          default:
            break;
        }
      }

      throw error;
    }
  }
}
