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

import {
  IdempotencyKeyError,
  type OperationAttemptService,
} from "../../../domain/application/services/operation-attempt-service";
import { canonicalOperationHash } from "../../../domain/application/services/canonical-operation-hash";
import { isValidUuidV7 } from "../../../core/security/uuidv7";

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
    private operationAttemptService?: OperationAttemptService,
  ) {}

  async handle(request: CancelBookingControllerRequest): Promise<HttpResponse> {
    try {
      const parsed = cancelBookingControllerRequest.parse(request);

      const headers = (request as any).headers as
        | Record<string, string | undefined>
        | undefined;
      const headerKey =
        headers?.["idempotency-key"] ?? headers?.["Idempotency-Key"];
      const rawRequestId =
        typeof headerKey === "string" && headerKey.trim() !== ""
          ? headerKey.trim()
          : undefined;

      if (rawRequestId && !isValidUuidV7(rawRequestId)) {
        return clientError({
          error:
            "Chave de idempotência inválida. Deve ser UUIDv7 com timestamp válido.",
          message:
            "Chave de idempotência inválida. Deve ser UUIDv7 com timestamp válido.",
          code: "INVALID_IDEMPOTENCY_KEY",
        });
      }

      if (rawRequestId && this.operationAttemptService) {
        const existingBooking = this.bookingsRepository
          ? await this.bookingsRepository.findById(parsed.bookingId)
          : null;

        const lockResources = {
          unitIds: existingBooking
            ? [existingBooking.barbershopId.toString()]
            : [],
          professionalIds: existingBooking
            ? [existingBooking.barbermanId.toString()]
            : [],
          bookingIds: [parsed.bookingId],
        };

        const payloadHash = canonicalOperationHash({
          action: "CANCEL_BOOKING",
          bookingId: parsed.bookingId,
          expectedVersion: parsed.expectedVersion,
          reason: parsed.reason,
          scope: parsed.scope,
        });

        const attemptResult = await this.operationAttemptService.executeOnce(
          {
            actorId: parsed.userId,
            operation: "CANCEL_BOOKING",
            requestId: rawRequestId,
            payloadHash,
            resourceKind: "BOOKING",
            lockResources,
          },
          async (tx, { serverTime }) => {
            const result = await this.cancelBookingUseCase.execute({
              bookingId: parsed.bookingId,
              actorId: parsed.userId,
              expectedVersion: parsed.expectedVersion,
              reason: parsed.reason,
              scope: parsed.scope,
              tx,
              serverTime,
            });

            if (result.isLeft()) {
              throw result.value;
            }

            const { booking, serverTime: bookingServerTime } = result.value;

            let bookingDto: any;
            if (this.bookingsRepository) {
              const details = await this.bookingsRepository.getDetails(
                booking.id.toString(),
                tx,
              );
              if (details) {
                bookingDto = BookingDetailsMapper.toHTTP(details, {
                  actorId: parsed.userId,
                  serverTime: new Date(bookingServerTime || Date.now()),
                  scope: parsed.scope,
                });
              }
            }

            if (!bookingDto) {
              bookingDto = BookingMapper.toHTTP(booking);
            }

            return {
              resourceKind: "BOOKING" as const,
              resourceId: booking.id.toString(),
              resourceVersion: booking.version,
              data: { booking: bookingDto, serverTime: bookingServerTime },
            };
          },
        );

        return ok(attemptResult.resource?.data ?? {});
      }

      const result = await this.cancelBookingUseCase.execute({
        bookingId: parsed.bookingId,
        actorId: parsed.userId,
        expectedVersion: parsed.expectedVersion,
        reason: parsed.reason,
        scope: parsed.scope,
      });

      if (result.isLeft()) {
        return this.handleError(result.value);
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
        return clientError({ errors: err.issues });
      }

      return this.handleError(err);
    }
  }

  private handleError(error: unknown): HttpResponse {
    if (error instanceof IdempotencyKeyError) {
      if (error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
        return conflict({
          code: error.code,
          error: error.message,
          message: error.message,
        });
      }
      return clientError({
        code: error.code,
        error: error.message,
        message: error.message,
      });
    }

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

    return clientError(
      error instanceof Error ? { message: error.message } : error,
    );
  }
}
