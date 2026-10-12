import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  forbidden,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { FetchUnitBookingsUseCase } from "../../../../domain/application/use-cases/barbershop/fetch-unit-bookings/fetch-unit-bookings";
import { BookingDetailsMapper } from "../../../../domain/enterprise/mappers/booking-details-mapper";

const fetchUnitBookingsSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  barbermanId: z.string().uuid().optional(),
  date: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class FetchUnitBookingsController implements Controller {
  constructor(private fetchUnitBookingsUseCase: FetchUnitBookingsUseCase) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = fetchUnitBookingsSchema.parse(request);

      const result = await this.fetchUnitBookingsUseCase.execute({
        shopId: parsed.shopId,
        actorId: parsed.userId,
        barbermanId: parsed.barbermanId,
        date: parsed.date,
        status: parsed.status,
        page: parsed.page,
        limit: parsed.limit,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof NotAllowedError) {
          return forbidden({ error: error.message, message: error.message });
        }
        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message, message: error.message });
        }
        return clientError({ error: error.message, message: error.message });
      }

      const serverTime = new Date();
      const mappedItems = result.value.items.map((item) =>
        BookingDetailsMapper.toHTTP(item, {
          actorId: parsed.userId,
          serverTime,
          scope: "UNIT",
        }),
      );

      return ok({
        items: mappedItems,
        page: result.value.page,
        limit: result.value.limit,
        total: result.value.total,
        hasNext: result.value.hasNext,
        serverTime: result.value.serverTime,
        summary: result.value.summary,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
