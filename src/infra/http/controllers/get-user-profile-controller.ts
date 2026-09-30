import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { GetUserProfileUseCase } from "../../../domain/application/use-cases/users/get-user-profile/get-user-profile";

const getUserProfileControllerRequest = z.object({
  userId: z.uuid(),
});

type GetUserProfileControllerRequest = z.infer<
  typeof getUserProfileControllerRequest
>;

export class GetUserProfileController implements Controller {
  constructor(private getUserProfileUseCase: GetUserProfileUseCase) {}

  async handle(
    request: GetUserProfileControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId } = getUserProfileControllerRequest.parse(request);

      const result = await this.getUserProfileUseCase.execute({
        userId,
      });

      if (result.isLeft()) {
        const error = result.value;

        return notFound(error.message);
      }

      const { user } = result.value;

      return ok({ user });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
