import { type Either, left, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import type { SignOutDTO } from "./sign-out-dto";
import type { SignOutResponse } from "./sign-out-response";

type SignOutUseCaseResponse = Either<UnauthorizedError, SignOutResponse>;

/** Encerra a sessão atual (`all: true` encerra todas as sessões do usuário). */
export class SignOutUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({ headers, all }: SignOutDTO): Promise<SignOutUseCaseResponse> {
    if (!headers) {
      return left(new UnauthorizedError("Sessão inválida ou expirada."));
    }

    try {
      const current = await this.authGateway.getSession(headers);

      if (!current) {
        return left(new UnauthorizedError("Sessão inválida ou expirada."));
      }

      if (all) {
        await this.authGateway.revokeAllSessions(headers);
        return right({ status: true, setCookies: [] });
      }

      const relay = await this.authGateway.signOut(headers);

      return right({ status: true, ...relay });
    } catch (error) {
      if (error instanceof AuthGatewayError && error.code === "UNAUTHORIZED") {
        return left(new UnauthorizedError("Sessão inválida ou expirada."));
      }

      throw error;
    }
  }
}
