import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  noContent,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { SignOutUseCase } from "../../../domain/application/use-cases/users/sign-out/sign-out";

const signOutControllerRequest = z.object({
  refresh_token: z.string().min(1),
});

type SignOutControllerRequest = z.infer<typeof signOutControllerRequest>;

export class SignOutController implements Controller {
  constructor(private signOutUseCase: SignOutUseCase) {}

  async handle(request: SignOutControllerRequest): Promise<HttpResponse> {
    try {
      const { refresh_token } = signOutControllerRequest.parse(request);

      await this.signOutUseCase.execute({ refresh_token });

      return noContent();
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
