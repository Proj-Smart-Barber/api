import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { SignInUserUseCase } from "../../../domain/application/use-cases/users/sign-in-user/sign-in-user";
import { authErrorResponse } from "./users/auth-error-response";
import { relayHeaders } from "../utils/relay-headers";
import { isAllowedRedirectUrl } from "../utils/is-allowed-redirect-url";

const signInUserControllerRequest = z.object({
  email: z.email(),
  password: z.string(),
  callbackURL: z.string().optional(),
});

type SignInUserControllerRequest = z.infer<typeof signInUserControllerRequest>;

export class SignInUserController implements Controller {
  constructor(private signInUserUseCase: SignInUserUseCase) {}

  async handle(request: SignInUserControllerRequest): Promise<HttpResponse> {
    try {
      const { email, password, callbackURL } =
        signInUserControllerRequest.parse(request);

      if (callbackURL && !isAllowedRedirectUrl(callbackURL)) {
        return clientError("URL de retorno não permitida.");
      }

      const result = await this.signInUserUseCase.execute({
        email,
        password,
        callbackURL,
      });

      if (result.isLeft()) {
        return (
          authErrorResponse(result.value) ??
          fail(new Error(String(result.value)))
        );
      }

      const { access_token, token, user, expiresAt, setCookies, authToken } =
        result.value;

      return created(
        { access_token, token, user, expiresAt },
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
