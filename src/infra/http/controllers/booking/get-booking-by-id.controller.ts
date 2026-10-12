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
import type { MembershipsRepository } from "../../../../domain/application/repositories/memberships-repository";
import { BookingDetailsMapper } from "../../../../domain/enterprise/mappers/booking-details-mapper";

const getBookingByIdSchema = z.object({
  bookingId: z.string().uuid({ message: "ID do agendamento inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
  scope: z.enum(["PERSONAL", "UNIT"]).optional(),
});

export class GetBookingByIdController implements Controller {
  constructor(
    private bookingsRepository: BookingsRepository,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const parsed = getBookingByIdSchema.parse(request);

      const b = await this.bookingsRepository.findByIdWithDetails(
        parsed.bookingId,
      );

      if (!b) {
        return notFound({ error: "Agendamento não encontrado." });
      }

      // Permite acesso se for o cliente ou o profissional responsável ou proprietário ativo da unidade
      const isCustomer = b.customer.id.toString() === parsed.userId;
      const isBarberman = b.barbermanId.toString() === parsed.userId;

      let isOwner = false;
      if (this.membershipsRepository) {
        const mem = await this.membershipsRepository.findByBarbershopAndUser(
          b.barbershopId.toString(),
          parsed.userId,
        );
        if (mem && mem.state === "ACTIVE" && mem.role === "OWNER") {
          isOwner = true;
        }
      }

      if (!isCustomer && !isBarberman && !isOwner) {
        return notFound({ error: "Agendamento não encontrado." });
      }

      let resolvedScope: "PERSONAL" | "UNIT";
      if (parsed.scope) {
        if (parsed.scope === "PERSONAL" && !isCustomer) {
          return notFound({ error: "Agendamento não encontrado." });
        }
        if (parsed.scope === "UNIT" && !(isBarberman || isOwner)) {
          return notFound({ error: "Agendamento não encontrado." });
        }
        resolvedScope = parsed.scope;
      } else {
        resolvedScope = isBarberman || isOwner ? "UNIT" : "PERSONAL";
      }

      return ok({
        booking: BookingDetailsMapper.toHTTP(b, {
          actorId: parsed.userId,
          scope: resolvedScope,
        }),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
