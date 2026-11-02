import type { Controller } from '../../../../core/infra/controller';
import {
  clientError,
  type HttpResponse,
  ok,
} from '../../../../core/infra/http-response';
import { LocationServiceUnavailableError } from '../../../../domain/application/use-cases/_errors/location-service-unavailable-error';
import {
  InvalidExploreCursorError,
  ExpiredExploreCursorError,
} from '../../../../domain/application/services/explore-cursor-token';
import type { GetExploreFeedUseCase } from '../../../../domain/application/use-cases/barbershop/get-explore-feed/get-explore-feed';
import { z, ZodError } from 'zod';

const exploreFeedBodySchema = z
  .object({
    mode: z.enum(['ALL', 'NEARBY']).optional(),
    latitude: z
      .number()
      .refine(Number.isFinite, 'Latitude deve ser finita.')
      .refine((lat) => lat >= -90 && lat <= 90, 'Latitude deve estar entre -90 e 90.')
      .optional(),
    longitude: z
      .number()
      .refine(Number.isFinite, 'Longitude deve ser finita.')
      .refine((lon) => lon >= -180 && lon <= 180, 'Longitude deve estar entre -180 e 180.')
      .optional(),
    radiusKm: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50)]).optional(),
    q: z.string().trim().max(120, 'Busca deve ter no máximo 120 caracteres.').optional(),
    regionKey: z.string().trim().max(60).optional(),
    limit: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val, ctx) => {
        if (val === undefined || val === null || val === '') return 10;
        const num = Number(val);
        if (!Number.isInteger(num) || num < 1 || num > 20) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Limite deve ser um inteiro entre 1 e 20.',
          });
          return z.NEVER;
        }
        return num;
      }),
    cursor: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const determinedMode = data.mode ?? (data.latitude !== undefined && data.longitude !== undefined ? 'NEARBY' : 'ALL');
    if (determinedMode === 'NEARBY') {
      if (data.latitude === undefined || data.longitude === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Latitude e Longitude são obrigatórias no modo NEARBY.',
        });
      }
    }
  });

export class ExploreFeedController implements Controller {
  constructor(private getExploreFeedUseCase: GetExploreFeedUseCase) {}

  async handle(request: Record<string, any>): Promise<HttpResponse> {
    try {
      const bodyPayload = request._body ?? request;
      const parsed = exploreFeedBodySchema.parse(bodyPayload);

      const mode = parsed.mode ?? (parsed.latitude !== undefined && parsed.longitude !== undefined ? 'NEARBY' : 'ALL');

      const result = await this.getExploreFeedUseCase.execute({
        mode,
        point:
          parsed.latitude !== undefined && parsed.longitude !== undefined
            ? { latitude: parsed.latitude, longitude: parsed.longitude }
            : undefined,
        radiusKm: parsed.radiusKm ?? (mode === 'NEARBY' ? 10 : undefined),
        q: parsed.q,
        regionKey: parsed.regionKey,
        limit: parsed.limit,
        cursor: parsed.cursor,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof LocationServiceUnavailableError) {
          return {
            statusCode: 503,
            body: { error: error.message, code: 'LOCATION_UNAVAILABLE' },
          };
        }
        if (error instanceof InvalidExploreCursorError) {
          return {
            statusCode: 400,
            body: { error: error.message, code: 'INVALID_CURSOR' },
          };
        }
        if (error instanceof ExpiredExploreCursorError) {
          return {
            statusCode: 400,
            body: { error: error.message, code: 'EXPIRED_CURSOR' },
          };
        }
        return {
          statusCode: 500,
          body: { error: 'Erro interno ao carregar feed explorar.' },
        };
      }

      return ok(result.value);
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError({
          error: error.issues[0]?.message ?? 'Parâmetros inválidos.',
        });
      }
      console.error('[ExploreFeedController] Unhandled error:', error);
      return {
        statusCode: 500,
        body: { error: 'Erro interno no servidor ao carregar feed.' },
      };
    }
  }
}
