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

import {
  IdempotencyKeyError,
  type OperationAttemptService,
} from "../../../../domain/application/services/operation-attempt-service";
import { canonicalOperationHash } from "../../../../domain/application/services/canonical-operation-hash";
import { isValidUuidV7 } from "../../../../core/security/uuidv7";

const transitionBookingStatusSchema = z.object({
  bookingId: z.string().uuid({ message: "ID do agendamento inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  status: z.enum(["COMPLETED", "NO_SHOW"], {
    message: "Status inválido. Aceito: COMPLETED ou NO_SHOW.",
  }),
  expectedVersion: z.coerce.number().int().min(1),
  reason: z.string().optional(),
});

type TransitionBookingStatusRequest = z.infer<
  typeof transitionBookingStatusSchema
>;

export class TransitionBookingStatusController implements Controller {
  constructor(
    private transitionBookingStatusUseCase: TransitionBookingStatusUseCase,
    private bookingsRepository?: BookingsRepository,
    private operationAttemptService?: OperationAttemptService,
  ) {}

  async handle(request: TransitionBookingStatusRequest): Promise<HttpResponse> {
    try {
      const parsed = transitionBookingStatusSchema.parse(request);

      const headers = (request as any).headers as
        | Record<string, string | undefined>
        | undefined;
      const headerKey =
        headers?.["idempotency-key"] ?? headers?.["Idempotency-Key"];
      const rawRequestId =
        typeof headerKey === "string" && headerKey.trim() !== ""
          ? headerKey.trim()
          : undefined;

      if (!rawRequestId)
        return clientError({
          code: "IDEMPOTENCY_KEY_REQUIRED",
          message: "Idempotency-Key obrigatório para alterar a reserva.",
        });

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
          action: "TRANSITION_BOOKING_STATUS",
          bookingId: parsed.bookingId,
          status: parsed.status,
          expectedVersion: parsed.expectedVersion,
          reason: parsed.reason,
        });

        const attemptResult = await this.operationAttemptService.executeOnce(
          {
            actorId: parsed.userId,
            operation: "TRANSITION_BOOKING_STATUS",
            requestId: rawRequestId,
            payloadHash,
            resourceKind: "BOOKING",
            lockResources,
          },
          async (tx, { serverTime }) => {
            const result = await this.transitionBookingStatusUseCase.execute({
              bookingId: parsed.bookingId,
              actorId: parsed.userId,
              status: parsed.status,
              expectedVersion: parsed.expectedVersion,
              reason: parsed.reason,
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
                  serverTime: new Date(bookingServerTime),
                  scope: "UNIT",
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

      const result = await this.transitionBookingStatusUseCase.execute({
        bookingId: parsed.bookingId,
        actorId: parsed.userId,
        status: parsed.status,
        expectedVersion: parsed.expectedVersion,
        reason: parsed.reason,
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

    return clientError(
      error instanceof Error ? { message: error.message } : error,
    );
  }
}
