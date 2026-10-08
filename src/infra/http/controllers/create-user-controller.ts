import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { CreateUserUseCase } from "../../../domain/application/use-cases/users/create-user/create-user";
import { authErrorResponse } from "./users/auth-error-response";
import { isAllowedRedirectUrl } from "../utils/is-allowed-redirect-url";
import { relayHeaders } from "../utils/relay-headers";

const createUserControllerRequest = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  cpf: z.string(),
  phoneNumber: z.string().optional(),
  callbackURL: z.string().optional(),
});

type CreateUserControllerRequest = z.infer<typeof createUserControllerRequest>;

export class CreateUserController implements Controller {
  constructor(private createUserUseCase: CreateUserUseCase) {}

  async handle(request: CreateUserControllerRequest): Promise<HttpResponse> {
    try {
      const { name, email, password, cpf, phoneNumber, callbackURL } =
        createUserControllerRequest.parse(request);

      if (callbackURL && !isAllowedRedirectUrl(callbackURL)) {
        return clientError("URL de retorno não permitida.");
      }

      const result = await this.createUserUseCase.execute({
        name,
        email,
        password,
        cpf,
        phoneNumber,
        callbackURL,
      });

      if (result.isLeft()) {
        return (
          authErrorResponse(result.value) ??
          fail(new Error(String(result.value)))
        );
      }

      const { userId, setCookies, authToken } = result.value;

      return created({ userId }, relayHeaders({ setCookies, authToken }));
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
