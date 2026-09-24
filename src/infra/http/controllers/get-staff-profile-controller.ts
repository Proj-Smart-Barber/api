import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { GetStaffProfileUseCase } from "../../../domain/application/use-cases/staff/get-staff-profile/get-staff-profile";

const getStaffProfileControllerRequest = z.object({
  userId: z.uuid(),
});

type GetStaffProfileControllerRequest = z.infer<
  typeof getStaffProfileControllerRequest
>;

export class GetStaffProfileController implements Controller {
  constructor(private getStaffProfileUseCase: GetStaffProfileUseCase) {}

  async handle(
    request: GetStaffProfileControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId } = getStaffProfileControllerRequest.parse(request);

      const result = await this.getStaffProfileUseCase.execute({
        staffId: userId,
      });

      if (result.isLeft()) {
        const error = result.value;

        return notFound(error.message);
      }

      const { staff } = result.value;

      return ok({ staff });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      // If 'err' is not an Error, wrap it
      return fail(new Error(String(err)));
    }
  }
}
