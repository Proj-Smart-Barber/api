import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { VerifyEmailUseCase } from "../../../domain/application/use-cases/users/verify-email/verify-email";

const verifyEmailControllerRequest = z.object({
  token: z.string().min(1),
});

type VerifyEmailControllerRequest = z.infer<
  typeof verifyEmailControllerRequest
>;

export class VerifyEmailController implements Controller {
  constructor(private verifyEmailUseCase: VerifyEmailUseCase) {}

  async handle(request: VerifyEmailControllerRequest): Promise<HttpResponse> {
    try {
      const { token } = verifyEmailControllerRequest.parse(request);

      const result = await this.verifyEmailUseCase.execute({ token });

      if (result.isLeft()) {
        return clientError(result.value.message);
      }

      const { userId, email, emailVerifiedAt, alreadyVerified } = result.value;

      return ok({
        verified: true,
        alreadyVerified,
        userId,
        email,
        emailVerifiedAt,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
