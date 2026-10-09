import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  forbidden,
  unauthorized,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { SignInUserUseCase } from "../../../domain/application/use-cases/users/sign-in-user/sign-in-user";
import { EmailNotVerifiedError } from "../../../domain/application/use-cases/_errors/email-not-verified-error";

const signInUserControllerRequest = z.object({
  email: z.email(),
  password: z.string(),
});

type SignInUserControllerRequest = z.infer<typeof signInUserControllerRequest>;

export class SignInUserController implements Controller {
  constructor(private signInUserUseCase: SignInUserUseCase) {}

  async handle(request: SignInUserControllerRequest): Promise<HttpResponse> {
    try {
      const { email, password } = signInUserControllerRequest.parse(request);

      const result = await this.signInUserUseCase.execute({
        email,
        password,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof EmailNotVerifiedError) {
          return forbidden({
            error: "email_not_verified",
            message: error.message,
          });
        }

        return unauthorized(error.message);
      }

      const { access_token, refresh_token } = result.value;

      return created({ access_token, refresh_token });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
