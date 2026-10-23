import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { UpdateUserAvatarUseCase } from "../../../../domain/application/use-cases/media/update-user-avatar/update-user-avatar";

const updateUserAvatarSchema = z.object({
  userId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

type UpdateUserAvatarRequest = z.infer<typeof updateUserAvatarSchema>;

export class UpdateUserAvatarController implements Controller {
  constructor(private updateUserAvatarUseCase: UpdateUserAvatarUseCase) {}

  async handle(request: UpdateUserAvatarRequest): Promise<HttpResponse> {
    try {
      const parsed = updateUserAvatarSchema.parse(request);

      const result = await this.updateUserAvatarUseCase.execute({
        userId: parsed.userId,
        mediaId: parsed.mediaId,
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
