import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  conflict,
  created,
  fail,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { CreateUserUseCase } from "../../../domain/application/use-cases/users/create-user/create-user";

const createUserControllerRequest = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  cpf: z.string(),
});

type CreateUserControllerRequest = z.infer<typeof createUserControllerRequest>;

export class CreateUserController implements Controller {
  constructor(private createUserUseCase: CreateUserUseCase) {}

  async handle(request: CreateUserControllerRequest): Promise<HttpResponse> {
    try {
      const { name, email, password, cpf } =
        createUserControllerRequest.parse(request);

      const result = await this.createUserUseCase.execute({
        name,
        email,
        password,
        cpf,
      });

      if (result.isLeft()) {
        const error = result.value;

        return conflict(error.message);
      }

      const { userId } = result.value;

      return created({ userId });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
