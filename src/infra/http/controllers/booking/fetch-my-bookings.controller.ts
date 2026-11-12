import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { BookingsRepository } from "../../../../domain/application/repositories/bookings-repository";

import { BookingDetailsMapper } from "../../../../domain/enterprise/mappers/booking-details-mapper";

const fetchMyBookingsSchema = z.object({
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
  page: z.coerce.number().min(1).optional(),
  view: z.enum(["all", "upcoming", "past"]).optional(),
  filter: z.enum(["all", "upcoming", "past"]).optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

export class FetchMyBookingsController implements Controller {
  constructor(private bookingsRepository: BookingsRepository) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const parsed = fetchMyBookingsSchema.parse(request);
      const page = parsed.page ?? 1;
      const limit =
        parsed.limit ??
        (parsed.view === "upcoming" || parsed.filter === "upcoming" ? 1 : 20);

      const bookings = await this.bookingsRepository.findManyByCustomerId(
        parsed.userId,
        {
          page,
          view: parsed.view,
          filter: parsed.filter,
          limit: parsed.limit,
          cursor: parsed.cursor,
        },
      );

      return ok({
        bookings: bookings.map((b) =>
          BookingDetailsMapper.toHTTP(b, {
            actorId: parsed.userId,
            scope: "PERSONAL",
          }),
        ),
        page,
        limit,
        hasNext: bookings.length === limit,
        serverTime: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
