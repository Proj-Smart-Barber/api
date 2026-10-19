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
import type { SearchGeocodingAddressUseCase } from "../../../../domain/application/use-cases/location/search-geocoding-address/search-geocoding-address";
import { GeocodingQuotaExceededError } from "../../../../domain/application/use-cases/_errors/geocoding-quota-exceeded-error";
import { LocationServiceUnavailableError } from "../../../../domain/application/use-cases/_errors/location-service-unavailable-error";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";

export class SearchGeocodingAddressController implements Controller {
  constructor(
    private searchGeocodingAddressUseCase: SearchGeocodingAddressUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      userId: z.string().uuid(),
      address: z.string().min(3).max(255),
      shopId: z.string().uuid().optional().nullable(),
    });

    try {
      const parsed = schema.parse(request);

      const result = await this.searchGeocodingAddressUseCase.execute({
        actorId: parsed.userId,
        address: parsed.address,
        shopId: parsed.shopId ?? null,
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

        if (error instanceof GeocodingQuotaExceededError) {
          return {
            statusCode: 429,
            headers: {
              "Retry-After": String(error.retryAfterSeconds),
            },
            body: {
              code: error.code,
              message: error.message,
              retryAfterSeconds: error.retryAfterSeconds,
              error: {
                code: error.code,
                message: error.message,
                retryAfterSeconds: error.retryAfterSeconds,
              },
            },
          };
        }

        if (error instanceof LocationServiceUnavailableError) {
          return {
            statusCode: 503,
            body: {
              code: error.code,
              message: error.message,
              error: {
                code: error.code,
                message: error.message,
              },
            },
          };
        }

        return clientError({
          code: "BAD_REQUEST",
          message: error.message,
          error: { code: "BAD_REQUEST", message: error.message },
        });
      }

      return ok({
        candidates: result.value.candidates,
        serverTime: new Date().toISOString(),
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return clientError({
          code: "VALIDATION_ERROR",
          message: "Erro de validação dos parâmetros de busca de endereço.",
          errors: err.issues,
          error: {
            code: "VALIDATION_ERROR",
            message: "Erro de validação dos parâmetros de busca de endereço.",
            details: err.issues,
          },
        });
      }

      if (err instanceof LocationServiceUnavailableError) {
        return {
          statusCode: 503,
          body: {
            code: err.code,
            message: err.message,
            error: {
              code: err.code,
              message: err.message,
            },
          },
        };
      }

      return fail(err as Error);
    }
  }
}
