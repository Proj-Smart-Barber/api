import type { Controller } from "../../../core/infra/controller";
import {
  fail,
  noContent,
  notFound,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { LogoutAllUseCase } from "../../../domain/application/use-cases/users/logout-all/logout-all";

export class LogoutAllController implements Controller {
  constructor(private logoutAllUseCase: LogoutAllUseCase) {}

  async handle(request: { userId: string }): Promise<HttpResponse> {
    try {
      const result = await this.logoutAllUseCase.execute({
        userId: request.userId,
      });

      if (result.isLeft()) {
        return notFound(result.value.message);
      }

      return noContent();
    } catch (err) {
      return fail(new Error(String(err)));
    }
  }
}
