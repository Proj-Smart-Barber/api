import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  conflict,
  created,
  fail,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { CreateStaffUseCase } from "../../../domain/application/use-cases/staff/create-staff/create-staff";

const createStaffControllerRequest = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  cpf: z.string(),
});

type CreateStaffControllerRequest = z.infer<
  typeof createStaffControllerRequest
>;

export class CreateStaffController implements Controller {
  constructor(private createStaffUseCase: CreateStaffUseCase) {}

  async handle(request: CreateStaffControllerRequest): Promise<HttpResponse> {
    try {
      const { name, email, password, cpf } =
        createStaffControllerRequest.parse(request);

      const result = await this.createStaffUseCase.execute({
        name,
        email,
        password,
        cpf,
      });

      if (result.isLeft()) {
        const error = result.value;

        return conflict(error.message);
      }

      const { staffId } = result.value;

      return created({ staffId });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      // If 'err' is not an Error, wrap it
      return fail(new Error(String(err)));
    }
  }
}
