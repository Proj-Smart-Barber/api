import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { SendEmailVerificationUseCase } from "../../../domain/application/use-cases/users/send-email-verification/send-email-verification";

const sendEmailVerificationControllerRequest = z.object({
  email: z.email(),
});

type SendEmailVerificationControllerRequest = z.infer<
  typeof sendEmailVerificationControllerRequest
>;

export class SendEmailVerificationController implements Controller {
  constructor(
    private sendEmailVerificationUseCase: SendEmailVerificationUseCase,
  ) {}

  async handle(
    request: SendEmailVerificationControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { email } = sendEmailVerificationControllerRequest.parse(request);

      const result = await this.sendEmailVerificationUseCase.execute({ email });

      if (result.isLeft()) {
        return fail(result.value);
      }

      const { sentTo } = result.value;

      return ok({ sentTo });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
