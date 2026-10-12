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

import {
  IdempotencyKeyError,
  type OperationAttemptService,
} from "../../../../domain/application/services/operation-attempt-service";
import { canonicalOperationHash } from "../../../../domain/application/services/canonical-operation-hash";
import { isValidUuidV7 } from "../../../../core/security/uuidv7";

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
    private operationAttemptService?: OperationAttemptService,
  ) {}

  async handle(request: RescheduleBookingRequest): Promise<HttpResponse> {
    try {
      const parsed = rescheduleBookingSchema.parse(request);

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

        const professionalIds = existingBooking
          ? Array.from(
              new Set([
                existingBooking.barbermanId.toString(),
                ...(parsed.barbermanId ? [parsed.barbermanId] : []),
              ]),
            )
          : parsed.barbermanId
            ? [parsed.barbermanId]
            : [];

        const lockResources = {
          unitIds: existingBooking
            ? [existingBooking.barbershopId.toString()]
            : [],
          professionalIds,
          bookingIds: [parsed.bookingId],
        };

        const payloadHash = canonicalOperationHash({
          action: "RESCHEDULE_BOOKING",
          bookingId: parsed.bookingId,
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

        const attemptResult = await this.operationAttemptService.executeOnce(
          {
            actorId: parsed.userId,
            operation: "RESCHEDULE_BOOKING",
            requestId: rawRequestId,
            payloadHash,
            resourceKind: "BOOKING",
            lockResources,
          },
          async (tx, { serverTime }) => {
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

    return clientError(
      error instanceof Error ? { message: error.message } : error,
    );
  }
}
