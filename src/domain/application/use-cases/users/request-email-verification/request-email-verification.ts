import { type Either, right } from "../../../../../core/logic/either";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import type { RequestEmailVerificationDTO } from "./request-email-verification-dto";
import type { RequestEmailVerificationResponse } from "./request-email-verification-response";

type RequestEmailVerificationUseCaseResponse = Either<
  never,
  RequestEmailVerificationResponse
>;

/**
 * Solicita confirmação de e-mail. O token é de uso único e expira em 1h;
 * a resposta é sempre a mesma, exista ou não a conta (sem enumeração).
 */
export class RequestEmailVerificationUseCase {
  constructor(private authGateway: AuthGateway) {}

  async execute({
    email,
    callbackURL,
  }: RequestEmailVerificationDTO): Promise<RequestEmailVerificationUseCaseResponse> {
    await this.authGateway.requestEmailVerification({
      email: email.trim().toLowerCase(),
      callbackURL,
    });

    return right({
      status: true,
      message: "Se o e-mail existir, você receberá um link de confirmação.",
    });
  }
}
