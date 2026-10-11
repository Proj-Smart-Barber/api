import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { BookingsRepository } from "../../../../domain/application/repositories/bookings-repository";

const fetchMyBookingsSchema = z.object({
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
  page: z.coerce.number().min(1).optional(),
});

export class FetchMyBookingsController implements Controller {
  constructor(private bookingsRepository: BookingsRepository) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const parsed = fetchMyBookingsSchema.parse(request);

      const bookings = await this.bookingsRepository.findManyByCustomerId(
        parsed.userId,
        { page: parsed.page ?? 1 },
      );

      return ok({
        bookings: bookings.map((b) => ({
          id: b.bookingId.toString(),
          barbershopId: b.barbershopId.toString(),
          barbermanId: b.barbermanId.toString(),
          date: b.date.toISOString(),
          startTime: b.startTime,
          endTime: b.endTime,
          createdAt: b.createdAt ? b.createdAt.toISOString() : null,
          customer: {
            id: b.customer.id.toString(),
            name: b.customer.name,
            phoneNumber: b.customer.phoneNumber,
          },
          services: b.services.map((s) => ({
            id: s.serviceId ?? s.id?.toString() ?? null,
            serviceId: s.serviceId,
            title: s.title,
            priceInCents: s.priceInCents,
            durationInMinutes: s.durationInMinutes,
            legacyAggregate: s.legacyAggregate,
          })),
        })),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
