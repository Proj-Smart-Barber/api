import { ZodError, z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  type HttpResponse,
  ok,
} from "../../../../core/infra/http-response";
import type { RequestPasswordResetUseCase } from "../../../../domain/application/use-cases/users/request-password-reset/request-password-reset";
import { authErrorResponse } from "./auth-error-response";
import { isAllowedRedirectUrl } from "../../utils/is-allowed-redirect-url";

const requestPasswordResetControllerRequest = z.object({
  email: z.email(),
  redirectTo: z.string().optional(),
});

type RequestPasswordResetControllerRequest = z.infer<
  typeof requestPasswordResetControllerRequest
>;

export class RequestPasswordResetController implements Controller {
  constructor(
    private requestPasswordResetUseCase: RequestPasswordResetUseCase,
  ) {}

  async handle(
    request: RequestPasswordResetControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { email, redirectTo } =
        requestPasswordResetControllerRequest.parse(request);

      if (redirectTo && !isAllowedRedirectUrl(redirectTo)) {
        return clientError("URL de retorno não permitida.");
      }

      const result = await this.requestPasswordResetUseCase.execute({
        email,
        redirectTo,
      });

      if (result.isLeft()) {
        return (
          authErrorResponse(result.value) ??
          fail(new Error(String(result.value)))
        );
      }

      return ok({ status: true, message: result.value.message });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
