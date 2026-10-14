import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  type HttpResponse,
  ok,
} from "../../../../core/infra/http-response";
import { LocationServiceUnavailableError } from "../../../../domain/application/use-cases/_errors/location-service-unavailable-error";
import type { SearchBarbershopsUseCase } from "../../../../domain/application/use-cases/barbershop/search-barbershops/search-barbershops";
import { z, ZodError } from "zod";

const searchBarbershopsQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(120, "Busca deve ter no máximo 120 caracteres.")
      .optional(),
    page: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val, ctx) => {
        if (val === undefined || val === null || val === "") return 1;
        const num = Number(val);
        if (!Number.isInteger(num) || num < 1 || num > 1_000_000) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Página deve ser um inteiro positivo.",
          });
          return z.NEVER;
        }
        return num;
      }),
    limit: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val, ctx) => {
        if (val === undefined || val === null || val === "") return 20;
        const num = Number(val);
        if (!Number.isInteger(num) || num < 1 || num > 50) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Limite deve ser um inteiro entre 1 e 50.",
          });
          return z.NEVER;
        }
        return num;
      }),
    latitude: z.any().optional(),
    longitude: z.any().optional(),
    radiusKm: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.latitude !== undefined || data.longitude !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Coordenadas não são permitidas nesta rota. Utilize /api/barbershops/nearby para busca por proximidade.",
      });
    }
    if (data.radiusKm !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Raio não é permitido nesta rota.",
      });
    }
  });

const searchNearbyBodySchema = z.object({
  latitude: z
    .number({
      message: "Latitude é obrigatória.",
    })
    .refine(Number.isFinite, "Latitude deve ser um número finito.")
    .refine(
      (lat) => lat >= -90 && lat <= 90,
      "Latitude deve estar entre -90 e 90.",
    ),
  longitude: z
    .number({
      message: "Longitude é obrigatória.",
    })
    .refine(Number.isFinite, "Longitude deve ser um número finito.")
    .refine(
      (lon) => lon >= -180 && lon <= 180,
      "Longitude deve estar entre -180 e 180.",
    ),
  radiusKm: z.literal(5).or(z.literal(10)).or(z.literal(25)).or(z.literal(50)),
  q: z
    .string()
    .trim()
    .max(120, "Busca deve ter no máximo 120 caracteres.")
    .optional(),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === null || val === "") return 1;
      const num = Number(val);
      if (!Number.isInteger(num) || num < 1 || num > 1_000_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Página deve ser um inteiro positivo.",
        });
        return z.NEVER;
      }
      return num;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === null || val === "") return 20;
      const num = Number(val);
      if (!Number.isInteger(num) || num < 1 || num > 50) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Limite deve ser um inteiro entre 1 e 50.",
        });
        return z.NEVER;
      }
      return num;
    }),
});

export class SearchBarbershopsController implements Controller {
  constructor(private searchBarbershopsUseCase: SearchBarbershopsUseCase) {}

  async handle(request: Record<string, any>): Promise<HttpResponse> {
    try {
      const parsed = searchBarbershopsQuerySchema.parse(request);

      const result = await this.searchBarbershopsUseCase.execute({
        mode: "ALL",
        q: parsed.q,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof LocationServiceUnavailableError) {
          return {
            statusCode: 503,
            body: { error: error.message },
          };
        }
        return fail(error);
      }

      return ok(result.value);
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError({
          error: error.issues[0]?.message ?? "Parâmetros inválidos.",
        });
      }
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export class SearchNearbyBarbershopsController implements Controller {
  constructor(private searchBarbershopsUseCase: SearchBarbershopsUseCase) {}

  async handle(request: Record<string, any>): Promise<HttpResponse> {
    try {
      const parsed = searchNearbyBodySchema.parse(request);

      const result = await this.searchBarbershopsUseCase.execute({
        mode: "NEARBY",
        point: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        },
        radiusKm: parsed.radiusKm,
        q: parsed.q,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof LocationServiceUnavailableError) {
          return {
            statusCode: 503,
            body: { error: error.message },
          };
        }
        return {
          statusCode: 500,
          body: { error: "Erro interno no processamento de proximidade." },
        };
      }

      return {
        statusCode: 200,
        body: result.value,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError({
          error: error.issues[0]?.message ?? "Parâmetros inválidos.",
        });
      }

      // Privacy: Sanitize errors to guarantee client position is never leaked to logs or response
      console.error(
        "[SearchNearbyBarbershopsController] Internal error during nearby discovery.",
      );
      return {
        statusCode: 500,
        body: {
          error: "Erro interno no serviço de descoberta por proximidade.",
        },
      };
    }
  }
}
