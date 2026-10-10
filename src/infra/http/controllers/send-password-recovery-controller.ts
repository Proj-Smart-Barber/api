import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { SendPasswordRecoveryUseCase } from "../../../domain/application/use-cases/users/send-password-recovery/send-password-recovery";

const sendPasswordRecoveryControllerRequest = z.object({
  email: z.email(),
});

type SendPasswordRecoveryControllerRequest = z.infer<
  typeof sendPasswordRecoveryControllerRequest
>;

export class SendPasswordRecoveryController implements Controller {
  constructor(
    private sendPasswordRecoveryUseCase: SendPasswordRecoveryUseCase,
  ) {}

  async handle(
    request: SendPasswordRecoveryControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { email } = sendPasswordRecoveryControllerRequest.parse(request);

      const result = await this.sendPasswordRecoveryUseCase.execute({ email });

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
