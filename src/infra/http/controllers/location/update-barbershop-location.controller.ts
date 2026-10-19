import { z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  conflict,
  forbidden,
  notFound,
  ok,
  fail,
} from "../../../../core/infra/http-response";
import {
  type UpdateBarbershopLocationUseCase,
  LocationConflictError,
} from "../../../../domain/application/use-cases/location/update-barbershop-location/update-barbershop-location";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";

export class UpdateBarbershopLocationController implements Controller {
  constructor(
    private updateBarbershopLocationUseCase: UpdateBarbershopLocationUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string().uuid(),
      userId: z.string().uuid(),
      address: z.string().min(3).max(255),
      candidateId: z.string().uuid(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      expectedVersion: z.number().int().min(0),
      mutationId: z.string().min(1).max(128).optional(),
    });

    try {
      const parsed = schema.parse(request);
      const mutationId =
        parsed.mutationId ||
        (request.headers?.["idempotency-key"] as string | undefined) ||
        (request.headers?.["x-idempotency-key"] as string | undefined);

      if (!mutationId || mutationId.length < 1 || mutationId.length > 128) {
        return clientError({
          code: "VALIDATION_ERROR",
          message:
            "Erro de validação dos parâmetros de atualização da localização comercial.",
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Erro de validação dos parâmetros de atualização da localização comercial.",
          },
        });
      }

      const result = await this.updateBarbershopLocationUseCase.execute({
        shopId: parsed.shopId,
        actorId: parsed.userId,
        address: parsed.address,
        candidateId: parsed.candidateId,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        expectedVersion: parsed.expectedVersion,
        mutationId,
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

        if (error instanceof LocationConflictError) {
          return conflict({
            code: error.code,
            message: error.message,
            error: { code: error.code, message: error.message },
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
            "Erro de validação dos parâmetros de atualização da localização comercial.",
          errors: err.issues,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Erro de validação dos parâmetros de atualização da localização comercial.",
            details: err.issues,
          },
        });
      }

      return fail(err as Error);
    }
  }
}
