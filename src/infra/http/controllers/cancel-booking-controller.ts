import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  conflict,
  forbidden,
  notFound,
  ok,
  fail,
  type HttpResponse,
  unauthorized,
} from "../../../core/infra/http-response";
import type { CancelBookingUseCase } from "../../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import type { BookingsRepository } from "../../../domain/application/repositories/bookings-repository";
import { BookingDetailsMapper } from "../../../domain/enterprise/mappers/booking-details-mapper";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";
import { UnauthorizedError } from "../../../domain/application/use-cases/_errors/unauthorized-error";
import { NotAllowedError } from "../../../domain/application/use-cases/_errors/not-allowed-error";
import {
  ActionDeadlinePassedError,
  BookingVersionConflictError,
  TerminalBookingStateError,
} from "../../../domain/application/use-cases/_errors/booking-errors";

const cancelBookingControllerRequest = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1).optional(),
  reason: z.string().optional(),
  scope: z.enum(["PERSONAL", "UNIT"]).optional(),
});

type CancelBookingControllerRequest = z.infer<
  typeof cancelBookingControllerRequest
>;

export class CancelBookingController implements Controller {
  constructor(
    private cancelBookingUseCase: CancelBookingUseCase,
    private bookingsRepository?: BookingsRepository,
  ) {}

  async handle(request: CancelBookingControllerRequest): Promise<HttpResponse> {
    try {
      const parsed = cancelBookingControllerRequest.parse(request);

      const result = await this.cancelBookingUseCase.execute({
        bookingId: parsed.bookingId,
        actorId: parsed.userId,
        expectedVersion: parsed.expectedVersion,
        reason: parsed.reason,
        scope: parsed.scope,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound(error.message);
        }

        if (error instanceof UnauthorizedError) {
          return unauthorized(error.message);
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
