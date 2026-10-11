import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { BookingsRepository } from "../../../../domain/application/repositories/bookings-repository";

const getBookingByIdSchema = z.object({
  bookingId: z.string().uuid({ message: "ID do agendamento inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
});

export class GetBookingByIdController implements Controller {
  constructor(private bookingsRepository: BookingsRepository) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const parsed = getBookingByIdSchema.parse(request);

      const b = await this.bookingsRepository.findByIdWithDetails(
        parsed.bookingId,
      );

      if (!b) {
        return notFound({ error: "Agendamento não encontrado." });
      }

      // Permite acesso se for o cliente ou o profissional responsável
      const isCustomer = b.customer.id.toString() === parsed.userId;
      const isBarberman = b.barbermanId.toString() === parsed.userId;

      if (!isCustomer && !isBarberman) {
        return notFound({ error: "Agendamento não encontrado." });
      }

      return ok({
        booking: {
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
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
