import { z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  forbidden,
  notFound,
  ok,
  fail,
} from "../../../../core/infra/http-response";
import type { GetBarbershopLocationUseCase } from "../../../../domain/application/use-cases/location/get-barbershop-location/get-barbershop-location";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";

export class GetBarbershopLocationController implements Controller {
  constructor(
    private getBarbershopLocationUseCase: GetBarbershopLocationUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string().uuid(),
      userId: z.string().uuid(),
    });

    try {
      const parsed = schema.parse(request);

      const result = await this.getBarbershopLocationUseCase.execute({
        shopId: parsed.shopId,
        actorId: parsed.userId,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof NotAllowedError) {
          return forbidden({
            code: "FORBIDDEN",
            message: error.message,
            error: { code: "FORBIDDEN", message: error.message },
          });
        }

        if (error instanceof ResourceNotFoundError) {
          return notFound({
            code: "NOT_FOUND",
            message: error.message,
            error: { code: "NOT_FOUND", message: error.message },
          });
        }

        return clientError({
          code: "BAD_REQUEST",
          message: error.message,
          error: { code: "BAD_REQUEST", message: error.message },
        });
      }

      return ok(result.value);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return clientError({
          code: "VALIDATION_ERROR",
          message:
            "Erro de validação dos parâmetros de consulta da localização comercial.",
          errors: err.issues,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Erro de validação dos parâmetros de consulta da localização comercial.",
            details: err.issues,
          },
        });
      }

      return fail(err as Error);
    }
  }
}
