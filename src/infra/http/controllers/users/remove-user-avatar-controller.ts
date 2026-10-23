import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { RemoveUserAvatarUseCase } from "../../../../domain/application/use-cases/media/remove-user-avatar/remove-user-avatar";

const removeUserAvatarSchema = z.object({
  userId: z.string().uuid(),
});

type RemoveUserAvatarRequest = z.infer<typeof removeUserAvatarSchema>;

export class RemoveUserAvatarController implements Controller {
  constructor(private removeUserAvatarUseCase: RemoveUserAvatarUseCase) {}

  async handle(request: RemoveUserAvatarRequest): Promise<HttpResponse> {
    try {
      const parsed = removeUserAvatarSchema.parse(request);

      const result = await this.removeUserAvatarUseCase.execute({
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError({ message: error.message });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
