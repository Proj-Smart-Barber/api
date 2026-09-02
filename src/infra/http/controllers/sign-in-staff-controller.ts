import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  unauthorized,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { SignInStaffUseCase } from "../../../domain/application/use-cases/staff/sign-in-staff/sign-in-staff";

const signInStaffControllerRequest = z.object({
  email: z.email(),
  password: z.string(),
});

type SignInStaffControllerRequest = z.infer<
  typeof signInStaffControllerRequest
>;

export class SignInStaffController implements Controller {
  constructor(private signInStaffUseCase: SignInStaffUseCase) {}

  async handle(request: SignInStaffControllerRequest): Promise<HttpResponse> {
    try {
      const { email, password } = signInStaffControllerRequest.parse(request);

      const result = await this.signInStaffUseCase.execute({
        email,
        password,
      });

      if (result.isLeft()) {
        const error = result.value;

        return unauthorized(error.message);
      }

      const { access_token } = result.value;

      return created({ access_token });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      // If 'err' is not an Error, wrap it
      return fail(new Error(String(err)));
    }
  }
}
