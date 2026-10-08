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
import type { RefreshSessionUseCase } from "../../../../domain/application/use-cases/users/refresh-session/refresh-session";
import { authErrorResponse } from "./auth-error-response";
import { relayHeaders } from "../../utils/relay-headers";

const refreshSessionControllerRequest = z.object({
  /** Token explícito (app nativo/SecureStore); web usa o cookie. */
  token: z.string().optional(),
});

type RefreshSessionControllerRequest = z.infer<
  typeof refreshSessionControllerRequest
>;

export class RefreshSessionController implements Controller {
  constructor(private refreshSessionUseCase: RefreshSessionUseCase) {}

  async handle(
    request: RefreshSessionControllerRequest,
    context?: ControllerContext,
  ): Promise<HttpResponse> {
    try {
      const { token } = refreshSessionControllerRequest.parse(request);

      const result = await this.refreshSessionUseCase.execute({
        token,
        headers: context?.headers,
      });

      if (result.isLeft()) {
        return (
          authErrorResponse(result.value) ??
          fail(new Error(String(result.value)))
        );
      }

      const {
        access_token,
        token: sessionToken,
        user,
        expiresAt,
        setCookies,
        authToken,
      } = result.value;

      return ok(
        {
          access_token,
          token: sessionToken,
          user,
          expiresAt,
        },
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
