import { ZodError, z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  type HttpResponse,
  ok,
} from "../../../../core/infra/http-response";
import type { ConfirmEmailVerificationUseCase } from "../../../../domain/application/use-cases/users/confirm-email-verification/confirm-email-verification";
import { authErrorResponse } from "./auth-error-response";
import { isAllowedRedirectUrl } from "../../utils/is-allowed-redirect-url";

const confirmEmailVerificationControllerRequest = z.object({
  token: z.string().min(1),
  callbackURL: z.string().optional(),
});

type ConfirmEmailVerificationControllerRequest = z.infer<
  typeof confirmEmailVerificationControllerRequest
>;

export class ConfirmEmailVerificationController implements Controller {
  constructor(
    private confirmEmailVerificationUseCase: ConfirmEmailVerificationUseCase,
  ) {}

  async handle(
    request: ConfirmEmailVerificationControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { token, callbackURL } =
        confirmEmailVerificationControllerRequest.parse(request);

      if (callbackURL && !isAllowedRedirectUrl(callbackURL)) {
        return clientError("URL de retorno não permitida.");
      }

      const result = await this.confirmEmailVerificationUseCase.execute({
        token,
        callbackURL,
      });

      if (result.isLeft()) {
        return (
          authErrorResponse(result.value) ??
          fail(new Error(String(result.value)))
        );
      }

      return ok({ status: true });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
