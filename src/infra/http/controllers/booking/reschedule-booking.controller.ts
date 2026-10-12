import { ZodError, z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  conflict,
  forbidden,
  notFound,
  ok,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { RescheduleBookingUseCase } from "../../../../domain/application/use-cases/booking/reschedule-booking/reschedule-booking";
import type { BookingsRepository } from "../../../../domain/application/repositories/bookings-repository";
import { BookingDetailsMapper } from "../../../../domain/enterprise/mappers/booking-details-mapper";
import { BookingMapper } from "../../../../domain/enterprise/mappers/booking-mapper";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import {
  ActionDeadlinePassedError,
  BookingVersionConflictError,
  QuoteChangedError,
  SlotUnavailableError,
  TerminalBookingStateError,
} from "../../../../domain/application/use-cases/_errors/booking-errors";

const rescheduleBookingSchema = z.object({
  bookingId: z.string().uuid({ message: "ID do agendamento inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  expectedVersion: z.coerce.number().int().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início inválido."),
  barbermanId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).optional(),
  expectedTotalPriceInCents: z.number().int().positive().optional(),
  expectedDurationInMinutes: z.number().int().positive().optional(),
  scope: z.enum(["PERSONAL", "UNIT"]).optional(),
  reason: z.string().optional(),
});

type RescheduleBookingRequest = z.infer<typeof rescheduleBookingSchema>;

export class RescheduleBookingController implements Controller {
  constructor(
    private rescheduleBookingUseCase: RescheduleBookingUseCase,
    private bookingsRepository?: BookingsRepository,
  ) {}

  async handle(request: RescheduleBookingRequest): Promise<HttpResponse> {
    try {
      const parsed = rescheduleBookingSchema.parse(request);

      const result = await this.rescheduleBookingUseCase.execute({
        bookingId: parsed.bookingId,
        actorId: parsed.userId,
        expectedVersion: parsed.expectedVersion,
        date: parsed.date,
        startTime: parsed.startTime,
        barbermanId: parsed.barbermanId,
        serviceIds: parsed.serviceIds,
        expectedTotalPriceInCents: parsed.expectedTotalPriceInCents,
        expectedDurationInMinutes: parsed.expectedDurationInMinutes,
        scope: parsed.scope,
        reason: parsed.reason,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound(error.message);
        }

        if (error instanceof NotAllowedError) {
          return forbidden(error.message);
        }

        if (error instanceof BookingVersionConflictError) {
          return conflict({
            error: "BOOKING_VERSION_CONFLICT",
            code: "BOOKING_VERSION_CONFLICT",
            message: error.message,
            currentVersion: error.currentVersion,
          });
        }

        if (error instanceof TerminalBookingStateError) {
          return conflict({
            error: "TERMINAL_BOOKING_STATE",
            code: "TERMINAL_BOOKING_STATE",
            message: error.message,
          });
        }

        if (error instanceof ActionDeadlinePassedError) {
          return conflict({
            error: "ACTION_DEADLINE_PASSED",
            code: "ACTION_DEADLINE_PASSED",
            message: error.message,
          });
        }

        if (error instanceof SlotUnavailableError) {
          return conflict({
            error: "SLOT_UNAVAILABLE",
            code: "SLOT_UNAVAILABLE",
            message: error.message,
          });
        }

        if (error instanceof QuoteChangedError) {
          return conflict({
            error: "QUOTE_CHANGED",
            code: "QUOTE_CHANGED",
            message: error.message,
            quote: error.quote,
            operationState: "NOT_APPLIED",
          });
        }

        return clientError(error);
      }

      const { booking, serverTime } = result.value;

      let bookingResponse: any = BookingMapper.toHTTP(booking);
      if (this.bookingsRepository) {
        const details = await this.bookingsRepository.findByIdWithDetails(
          booking.id.toString(),
        );
        if (details) {
          bookingResponse = BookingDetailsMapper.toHTTP(details, {
            actorId: parsed.userId,
            serverTime: serverTime ? new Date(serverTime) : undefined,
          });
        }
      }

      return ok({
        booking: bookingResponse,
        serverTime,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
