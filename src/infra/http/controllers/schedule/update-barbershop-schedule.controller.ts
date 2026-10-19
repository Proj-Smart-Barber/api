import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  forbidden,
  notFound,
  conflict,
  ok,
  fail,
} from "../../../../core/infra/http-response";
import type { UpdateBarbershopScheduleUseCase } from "../../../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import { ScheduleBookingConflictError } from "../../../../domain/application/use-cases/_errors/schedule-booking-conflict-error";
import { ScheduleCustomConflictError } from "../../../../domain/application/use-cases/_errors/schedule-custom-conflict-error";
import { ScheduleVersionConflictError } from "../../../../domain/application/use-cases/_errors/schedule-version-conflict-error";
import { IdempotencyKeyError } from "../../../../domain/application/services/operation-attempt-service";
import { z } from "zod";

export class UpdateBarbershopScheduleController implements Controller {
  constructor(
    private updateBarbershopScheduleUseCase: UpdateBarbershopScheduleUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      userId: z.string().uuid(),
      barbermanId: z.string().nullable().optional(),
      state: z.enum(["INHERIT", "CUSTOM", "CLOSED"]).optional(),
      expectedVersion: z.coerce.number().optional(),
      requestId: z.string().optional(),
      idempotencyKey: z.string().optional(),
      schedules: z.array(
        z.object({
          dayOfWeek: z
            .string()
            .transform((val) => val.toUpperCase())
            .pipe(
              z.enum([
                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
                "SUNDAY",
              ]),
            ),
          openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      ),
    });

    try {
      const parsedData = schema.parse(request);
      const requestId =
        parsedData.requestId ||
        parsedData.idempotencyKey ||
        (request.headers?.["idempotency-key"] as string | undefined) ||
        (request.headers?.["x-idempotency-key"] as string | undefined);

      const result = await this.updateBarbershopScheduleUseCase.execute({
        barbershopId: parsedData.shopId,
        barbermanId: parsedData.barbermanId ?? null,
        createdBy: parsedData.userId,
        schedules: parsedData.schedules,
        state: parsedData.state,
        expectedVersion: parsedData.expectedVersion,
        requestId,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof NotAllowedError) {
          return forbidden({
            code: "FORBIDDEN",
            message: error.message,
            error: { code: "FORBIDDEN", message: error.message },
          });
        }

        if (error instanceof ResourceNotFoundError) {
          return notFound({
            code: "NOT_FOUND",
            message: error.message,
            error: { code: "NOT_FOUND", message: error.message },
          });
        }

        if (error instanceof ScheduleBookingConflictError) {
          return conflict({
            code: error.code,
            message: error.message,
            conflicts: error.conflictingBookings,
            error: {
              code: error.code,
              message: error.message,
              details: error.conflictingBookings,
            },
          });
        }

        if (error instanceof ScheduleCustomConflictError) {
          return conflict({
            code: error.code,
            message: error.message,
            conflicts: error.conflictingSchedules,
            conflictingBarbers: error.conflictingSchedules,
            error: {
              code: error.code,
              message: error.message,
              details: error.conflictingSchedules,
            },
          });
        }

        if (error instanceof ScheduleVersionConflictError) {
          return conflict({
            code: error.code,
            message: error.message,
            error: { code: error.code, message: error.message },
          });
        }

        if (error instanceof IdempotencyKeyError) {
          if (
            error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH" ||
            error.code === "OPERATION_ALREADY_CLOSED"
          ) {
            return conflict({
              code: error.code,
              message: error.message,
              error: { code: error.code, message: error.message },
            });
          }

          return clientError({
            code: error.code,
            message: error.message,
            error: { code: error.code, message: error.message },
          });
        }

        return clientError({
          code: "BAD_REQUEST",
          message: error.message,
          error: { code: "BAD_REQUEST", message: error.message },
        });
      }

      const { schedules, effectiveSchedules, state, version, serverTime } =
        result.value;

      return ok({
        message: "Jornada atualizada com sucesso.",
        schedules: schedules.map((s) => ({
          id: s.id.toString(),
          barbershopId: s.barbershopId.toString(),
          barbermanId: s.barbermanId?.toString() ?? null,
          dayOfWeek: s.dayOfWeek,
          openTime: s.openTime,
          closeTime: s.closeTime,
        })),
        effectiveSchedules: effectiveSchedules.map((s) => ({
          id: s.id.toString(),
          barbershopId: s.barbershopId.toString(),
          barbermanId: s.barbermanId?.toString() ?? null,
          dayOfWeek: s.dayOfWeek,
          openTime: s.openTime,
          closeTime: s.closeTime,
        })),
        state,
        version,
        serverTime,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return clientError({
          code: "VALIDATION_ERROR",
          message: "Erro de validação dos dados de jornada.",
          errors: err.issues,
          error: {
            code: "VALIDATION_ERROR",
            message: "Erro de validação dos dados de jornada.",
            details: err.issues,
          },
        });
      }
      return fail(err as Error);
    }
  }
}
