import { type Either, left, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import type { RefreshSessionDTO } from "./refresh-session-dto";
import type { RefreshSessionResponse } from "./refresh-session-response";

type RefreshSessionUseCaseResponse = Either<
  UnauthorizedError,
  RefreshSessionResponse
>;

/**
 * Refresh explícito de sessão: valida o token (cookie web, `Bearer` ou token
 * enviado no corpo, como no app nativo) e estende a expiração conforme a
 * política do papel. Sessão expirada/revogada nunca volta a dar acesso.
 */
export class RefreshSessionUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({
    token,
    headers,
  }: RefreshSessionDTO): Promise<RefreshSessionUseCaseResponse> {
    try {
      const session = await this.authGateway.refreshSession({
        token,
        headers,
      });

      if (!session) {
        return left(new UnauthorizedError("Sessão inválida ou expirada."));
      }

      return right({
        token: session.token,
        access_token: session.token,
        user: session.user,
        expiresAt: session.expiresAt,
        setCookies: session.setCookies,
        authToken: session.authToken,
      });
    } catch (error) {
      if (error instanceof AuthGatewayError) {
        if (
          error.code === "UNAUTHORIZED" ||
          error.code === "INVALID_CREDENTIALS"
        ) {
          return left(new UnauthorizedError("Sessão inválida ou expirada."));
        }
      }

      throw error;
    }
  }
}
