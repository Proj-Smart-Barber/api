import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  unauthorized,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { RefreshSessionUseCase } from "../../../domain/application/use-cases/users/refresh-session/refresh-session";

const refreshSessionControllerRequest = z.object({
  refresh_token: z.string().min(1),
});

type RefreshSessionControllerRequest = z.infer<
  typeof refreshSessionControllerRequest
>;

export class RefreshSessionController implements Controller {
  constructor(private refreshSessionUseCase: RefreshSessionUseCase) {}

  async handle(
    request: RefreshSessionControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { refresh_token } = refreshSessionControllerRequest.parse(request);

      const result = await this.refreshSessionUseCase.execute({
        refresh_token,
      });

      if (result.isLeft()) {
        const error = result.value;

        return unauthorized(error.message);
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
