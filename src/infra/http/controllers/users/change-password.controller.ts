import { ZodError, z } from "zod";
import type {
  Controller,
  ControllerContext,
} from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  type HttpResponse,
  ok,
} from "../../../../core/infra/http-response";
import type { ChangePasswordUseCase } from "../../../../domain/application/use-cases/users/change-password/change-password";
import { authErrorResponse } from "./auth-error-response";
import { relayHeaders } from "../../utils/relay-headers";

const changePasswordControllerRequest = z.object({
  userId: z.uuid(),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

type ChangePasswordControllerRequest = z.infer<
  typeof changePasswordControllerRequest
>;

export class ChangePasswordController implements Controller {
  constructor(private changePasswordUseCase: ChangePasswordUseCase) {}

  async handle(
    request: ChangePasswordControllerRequest,
    context?: ControllerContext,
  ): Promise<HttpResponse> {
    try {
      const { userId, currentPassword, newPassword } =
        changePasswordControllerRequest.parse(request);

      const result = await this.changePasswordUseCase.execute({
        userId,
        headers: context?.headers,
        currentPassword,
        newPassword,
      });

      if (result.isLeft()) {
        return (
          authErrorResponse(result.value) ??
          fail(new Error(String(result.value)))
        );
      }

      const { message, setCookies, authToken } = result.value;

      return ok(
        { status: true, message },
        relayHeaders({ setCookies, authToken }),
      );
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
