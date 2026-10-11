import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  unauthorized,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { ChangePasswordUseCase } from "../../../domain/application/use-cases/users/change-password/change-password";
import { InvalidCredentialsError } from "../../../domain/application/use-cases/_errors/invalid-credentials-error";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";

const changePasswordRequest = z.object({
  userId: z.uuid(),
  currentPassword: z.string(),
  newPassword: z.string(),
});

type ChangePasswordRequest = z.infer<typeof changePasswordRequest>;

export class ChangePasswordController implements Controller {
  constructor(private changePasswordUseCase: ChangePasswordUseCase) {}

  async handle(request: ChangePasswordRequest): Promise<HttpResponse> {
    try {
      const { userId, currentPassword, newPassword } =
        changePasswordRequest.parse(request);

      const result = await this.changePasswordUseCase.execute({
        userId,
        currentPassword,
        newPassword,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof InvalidCredentialsError) {
          return unauthorized(error.message);
        }
        if (error instanceof ResourceNotFoundError) {
          return notFound(error.message);
        }
        return clientError(error.message);
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
