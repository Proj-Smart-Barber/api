import type {
  Controller,
  ControllerContext,
} from "../../../../core/infra/controller";
import {
  fail,
  type HttpResponse,
  ok,
} from "../../../../core/infra/http-response";
import type { SignOutUseCase } from "../../../../domain/application/use-cases/users/sign-out/sign-out";
import { authErrorResponse } from "./auth-error-response";
import { relayHeaders } from "../../utils/relay-headers";

export class SignOutController implements Controller {
  constructor(
    private signOutUseCase: SignOutUseCase,
    private options: { all?: boolean } = {},
  ) {}

  async handle(
    _request: unknown,
    context?: ControllerContext,
  ): Promise<HttpResponse> {
    try {
      const result = await this.signOutUseCase.execute({
        headers: context?.headers,
        all: this.options.all,
      });

      if (result.isLeft()) {
        return (
          authErrorResponse(result.value) ??
          fail(new Error(String(result.value)))
        );
      }

      const { setCookies, authToken } = result.value;

      return ok({ status: true }, relayHeaders({ setCookies, authToken }));
    } catch (err) {
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
