import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { ResetPasswordUseCase } from "../../../domain/application/use-cases/users/reset-password/reset-password";

const resetPasswordControllerRequest = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

type ResetPasswordControllerRequest = z.infer<
  typeof resetPasswordControllerRequest
>;

export class ResetPasswordController implements Controller {
  constructor(private resetPasswordUseCase: ResetPasswordUseCase) {}

  async handle(request: ResetPasswordControllerRequest): Promise<HttpResponse> {
    try {
      const { token, newPassword } =
        resetPasswordControllerRequest.parse(request);

      const result = await this.resetPasswordUseCase.execute({
        token,
        newPassword,
      });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      const { userId, email, passwordUpdatedAt } = result.value;

      return ok({ userId, email, passwordUpdatedAt });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
