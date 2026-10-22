import { z, ZodError } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  conflict,
  created,
  fail,
  forbidden,
  notFound,
  type HttpResponse,
} from "../../../core/infra/http-response";
import {
  SlotUnavailableError,
  QuoteChangedError,
  MembershipInactiveError,
  CustomerNotEligibleError,
} from "../../../domain/application/use-cases/_errors/booking-errors";
import { BookingConflictError } from "../../../domain/application/use-cases/_errors/booking-conflict-error";
import { NotAllowedError } from "../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { CreateBookingUseCase } from "../../../domain/application/use-cases/booking/create-booking/create-booking";
import type { BookingsRepository } from "../../../domain/application/repositories/bookings-repository";
import type { ServicesRepository } from "../../../domain/application/repositories/services-repository";
import {
  IdempotencyKeyError,
  type OperationAttemptService,
} from "../../../domain/application/services/operation-attempt-service";
import { canonicalOperationHash } from "../../../domain/application/services/canonical-operation-hash";
import { isValidUuidV7 } from "../../../core/security/uuidv7";
import { BookingDetailsMapper } from "../../../domain/enterprise/mappers/booking-details-mapper";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";

const createBookingControllerRequest = z.object({
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  scope: z.enum(["PERSONAL", "UNIT"]).optional().default("PERSONAL"),
  shopId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).optional(),
  barbermanId: z.string().uuid({ message: "ID do profissional inválido." }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início inválido."),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horário de fim inválido.")
    .optional(),
  slotStartAt: z.string().datetime({ offset: true }).optional(),
  expectedTotalPriceInCents: z.number().int().positive().optional(),
  expectedDurationInMinutes: z.number().int().positive().optional(),
});

export class CreateBookingController implements Controller {
  constructor(
    private createBookingUseCase: CreateBookingUseCase,
    private operationAttemptService?: OperationAttemptService,
    private bookingsRepository?: BookingsRepository,
    private servicesRepository?: ServicesRepository,
  ) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = createBookingControllerRequest.parse(request);

      const headers = request.headers as
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

      // Se temos Idempotency-Key e OperationAttemptService, rodar via ledger
      if (rawRequestId && this.operationAttemptService) {
        // Pré-descobrir unitId dos serviços se não foi passado shopId
        let resolvedShopId = parsed.shopId;
        if (!resolvedShopId && this.servicesRepository) {
          const firstServiceId =
            (parsed.serviceIds && parsed.serviceIds[0]) || parsed.serviceId;
          if (firstServiceId) {
            const svc = await this.servicesRepository.findById(firstServiceId);
            if (svc) {
              resolvedShopId = svc.barbershopId.toString();
            }
          }
        }

        const lockResources = {
          unitIds: resolvedShopId ? [resolvedShopId] : [],
          professionalIds: [parsed.barbermanId],
        };

        const payloadHash = canonicalOperationHash({
          action: "CREATE_BOOKING",
          slotStartAt: parsed.slotStartAt
            ? new Date(parsed.slotStartAt).toISOString()
            : undefined,
          scope: parsed.scope,
          shopId: resolvedShopId,
          customerId: parsed.customerId ?? parsed.userId,
          barbermanId: parsed.barbermanId,
          serviceIds:
            parsed.serviceIds ?? (parsed.serviceId ? [parsed.serviceId] : []),
          date: parsed.date,
          startTime: parsed.startTime,
          expectedTotalPriceInCents: parsed.expectedTotalPriceInCents,
          expectedDurationInMinutes: parsed.expectedDurationInMinutes,
        });

        const attemptResult = await this.operationAttemptService.executeOnce(
          {
            actorId: parsed.userId,
            operation: "CREATE_BOOKING",
            requestId: rawRequestId,
            payloadHash,
            resourceKind: "BOOKING",
            lockResources,
          },
          async (tx, { serverTime }) => {
            const result = await this.createBookingUseCase.execute({
              actorId: parsed.userId,
              scope: parsed.scope,
              shopId: parsed.shopId ?? resolvedShopId,
              customerId: parsed.customerId,
              serviceId: parsed.serviceId,
              serviceIds: parsed.serviceIds,
              barbermanId: parsed.barbermanId,
              date: parsed.date,
              startTime: parsed.startTime,
              endTime: parsed.endTime,
              slotStartAt: parsed.slotStartAt,
              expectedTotalPriceInCents: parsed.expectedTotalPriceInCents,
              expectedDurationInMinutes: parsed.expectedDurationInMinutes,
              clientRequestId: rawRequestId,
              tx,
              clockTime: serverTime,
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

        return created(attemptResult.resource?.data ?? {});
      }

      // Execução direta sem Idempotency-Key
      const result = await this.createBookingUseCase.execute({
        actorId: parsed.userId,
        scope: parsed.scope,
        shopId: parsed.shopId,
        customerId: parsed.customerId,
        serviceId: parsed.serviceId,
        serviceIds: parsed.serviceIds,
        barbermanId: parsed.barbermanId,
        date: parsed.date,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        slotStartAt: parsed.slotStartAt,
        expectedTotalPriceInCents: parsed.expectedTotalPriceInCents,
        expectedDurationInMinutes: parsed.expectedDurationInMinutes,
      });

      if (result.isLeft()) {
        return this.handleError(result.value, rawRequestId);
      }

      const { booking, serverTime } = result.value;

      let bookingDto: any;
      if (this.bookingsRepository) {
        const details = await this.bookingsRepository.getDetails(
          booking.id.toString(),
        );
        if (details) {
          bookingDto = BookingDetailsMapper.toHTTP(details, {
            actorId: parsed.userId,
            serverTime: new Date(serverTime),
            scope: parsed.scope,
          });
        }
      }

      if (!bookingDto) {
        bookingDto = BookingMapper.toHTTP(booking);
      }

      return created({
        booking: bookingDto,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return this.handleError(err);
    }
  }

  private handleError(error: unknown, requestId?: string): HttpResponse {
    if (error instanceof QuoteChangedError) {
      return conflict({
        code: error.code,
        message: error.message,
        error: error.message,
        operationState: error.operationState,
        requestId,
        quote: error.quote,
        serverTime: error.serverTime,
      });
    }

    if (error instanceof SlotUnavailableError) {
      return conflict({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }

    if (error instanceof BookingConflictError) {
      return conflict({
        code: "SLOT_UNAVAILABLE",
        message: error.message,
        error: error.message,
      });
    }

    if (error instanceof MembershipInactiveError) {
      return forbidden({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }

    if (error instanceof CustomerNotEligibleError) {
      return clientError({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }

    if (error instanceof NotAllowedError) {
      return forbidden({
        message: error.message,
        error: error.message,
      });
    }

    if (error instanceof ResourceNotFoundError) {
      return notFound({
        message: error.message,
        error: error.message,
      });
    }

    if (error instanceof IdempotencyKeyError) {
      if (
        error.code === "INVALID_IDEMPOTENCY_KEY" ||
        error.code === "IDEMPOTENCY_KEY_FUTURE_TIMESTAMP"
      ) {
        return clientError({
          code: error.code,
          message: error.message,
          error: error.message,
        });
      }
      return conflict({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }

    if (
      error instanceof Error &&
      error.message === "IDEMPOTENCY_PAYLOAD_MISMATCH"
    ) {
      return conflict({
        code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
        message: "Payload incompatível com a chave de tentativa.",
        error: "Payload incompatível com a chave de tentativa.",
      });
    }

    if (error instanceof Error) {
      return clientError({
        message: error.message,
        error: error.message,
      });
    }

    return fail(new Error(String(error)));
  }
}
