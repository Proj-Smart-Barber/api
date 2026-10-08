import { ZodError, z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  type HttpResponse,
  ok,
} from "../../../../core/infra/http-response";
import type { ConfirmPasswordResetUseCase } from "../../../../domain/application/use-cases/users/confirm-password-reset/confirm-password-reset";
import { authErrorResponse } from "./auth-error-response";

const confirmPasswordResetControllerRequest = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

type ConfirmPasswordResetControllerRequest = z.infer<
  typeof confirmPasswordResetControllerRequest
>;

export class ConfirmPasswordResetController implements Controller {
  constructor(
    private confirmPasswordResetUseCase: ConfirmPasswordResetUseCase,
  ) {}

  async handle(
    request: ConfirmPasswordResetControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { token, newPassword } =
        confirmPasswordResetControllerRequest.parse(request);

      const result = await this.confirmPasswordResetUseCase.execute({
        token,
        newPassword,
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
