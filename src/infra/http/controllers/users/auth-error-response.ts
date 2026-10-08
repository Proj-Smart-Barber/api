import {
  clientError,
  conflict,
  type HttpResponse,
  notFound,
  tooManyRequests,
  unauthorized,
} from "../../../../core/infra/http-response";
import { CPFOrEmailAlreadyInUseError } from "../../../../domain/application/use-cases/_errors/cpf-or-email-already-in-use-error";
import { InvalidCpfError } from "../../../../domain/application/use-cases/_errors/invalid-cpf-error";
import { InvalidCredentialsError } from "../../../../domain/application/use-cases/_errors/invalid-credentials-error";
import { InvalidPasswordError } from "../../../../domain/application/use-cases/_errors/invalid-password-error";
import { InvalidTokenError } from "../../../../domain/application/use-cases/_errors/invalid-token-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import { TooManyRequestsError } from "../../../../domain/application/use-cases/_errors/too-many-requests-error";
import { UnauthorizedError } from "../../../../domain/application/use-cases/_errors/unauthorized-error";
import { WeakPasswordError } from "../../../../domain/application/use-cases/_errors/weak-password-error";

/**
 * Converte erros de domínio dos fluxos de autenticação em respostas HTTP
 * consistentes (400/401/404/409/429) — nada de 500 com erro cru.
 */
export function authErrorResponse(error: unknown): HttpResponse | null {
  if (error instanceof InvalidCpfError) return clientError(error.message);
  if (error instanceof InvalidTokenError) return clientError(error.message);
  if (error instanceof InvalidPasswordError) return unauthorized(error.message);
  if (error instanceof WeakPasswordError) return clientError(error.message);
  if (error instanceof InvalidCredentialsError)
    return unauthorized(error.message);
  if (error instanceof UnauthorizedError) return unauthorized(error.message);
  if (error instanceof TooManyRequestsError)
    return tooManyRequests(error.message);
  if (error instanceof CPFOrEmailAlreadyInUseError)
    return conflict(error.message);
  if (error instanceof ResourceNotFoundError) return notFound(error.message);

  return null;
}
