import { ZodError, z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  type HttpResponse,
  ok,
} from "../../../../core/infra/http-response";
import type { RequestEmailVerificationUseCase } from "../../../../domain/application/use-cases/users/request-email-verification/request-email-verification";
import { authErrorResponse } from "./auth-error-response";
import { isAllowedRedirectUrl } from "../../utils/is-allowed-redirect-url";

const requestEmailVerificationControllerRequest = z.object({
  email: z.email(),
  callbackURL: z.string().optional(),
});

type RequestEmailVerificationControllerRequest = z.infer<
  typeof requestEmailVerificationControllerRequest
>;

export class RequestEmailVerificationController implements Controller {
  constructor(
    private requestEmailVerificationUseCase: RequestEmailVerificationUseCase,
  ) {}

  async handle(
    request: RequestEmailVerificationControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { email, callbackURL } =
        requestEmailVerificationControllerRequest.parse(request);

      if (callbackURL && !isAllowedRedirectUrl(callbackURL)) {
        return clientError("URL de retorno não permitida.");
      }

      const result = await this.requestEmailVerificationUseCase.execute({
        email,
        callbackURL,
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
