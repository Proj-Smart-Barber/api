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
import type { TransitionBookingStatusUseCase } from "../../../../domain/application/use-cases/booking/transition-booking-status/transition-booking-status";
import type { BookingsRepository } from "../../../../domain/application/repositories/bookings-repository";
import { BookingDetailsMapper } from "../../../../domain/enterprise/mappers/booking-details-mapper";
import { BookingMapper } from "../../../../domain/enterprise/mappers/booking-mapper";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import {
  ActionDeadlinePassedError,
  BookingVersionConflictError,
  TerminalBookingStateError,
} from "../../../../domain/application/use-cases/_errors/booking-errors";

const transitionBookingStatusSchema = z.object({
  bookingId: z.string().uuid({ message: "ID do agendamento inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  status: z.enum(["COMPLETED", "NO_SHOW"], {
    message: "Status inválido. Aceito: COMPLETED ou NO_SHOW.",
  }),
  expectedVersion: z.coerce.number().int().min(1).optional(),
  reason: z.string().optional(),
});

type TransitionBookingStatusRequest = z.infer<
  typeof transitionBookingStatusSchema
>;

export class TransitionBookingStatusController implements Controller {
  constructor(
    private transitionBookingStatusUseCase: TransitionBookingStatusUseCase,
    private bookingsRepository?: BookingsRepository,
  ) {}

  async handle(request: TransitionBookingStatusRequest): Promise<HttpResponse> {
    try {
      const parsed = transitionBookingStatusSchema.parse(request);

      const result = await this.transitionBookingStatusUseCase.execute({
        bookingId: parsed.bookingId,
        actorId: parsed.userId,
        status: parsed.status,
        expectedVersion: parsed.expectedVersion,
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
            code: "BOOKING_VERSION_CONFLICT",
            message: error.message,
            currentVersion: error.currentVersion,
          });
        }

        if (error instanceof TerminalBookingStateError) {
          return conflict({
            code: "TERMINAL_BOOKING_STATE",
            message: error.message,
          });
        }

        if (error instanceof ActionDeadlinePassedError) {
          return conflict({
            code: "ACTION_DEADLINE_PASSED",
            message: error.message,
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
