import type { Controller } from "@/core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  fail,
  forbidden,
  notFound,
} from "@/core/infra/http-response";
import { z } from "zod";
import type { UpdateScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/update-schedule-exception/update-schedule-exception";

const updateScheduleExceptionBodySchema = z.object({
  shopId: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().date().optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  reason: z.string().optional().nullable(),
});

export class UpdateScheduleExceptionController implements Controller {
  constructor(
    private updateScheduleExceptionUseCase: UpdateScheduleExceptionUseCase,
  ) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const { exceptionId } = z
        .object({ exceptionId: z.string().uuid() })
        .parse(request);
      const { shopId, userId, date, startTime, endTime, reason } =
        updateScheduleExceptionBodySchema.parse(request);

      const result = await this.updateScheduleExceptionUseCase.execute({
        exceptionId,
        barbershopId: shopId,
        staffId: userId,
        date,
        startTime,
        endTime,
        reason,
      });

      if (result.isLeft()) {
        const error = result.value;
        switch (error.constructor.name) {
          case "ResourceNotFoundError":
            return notFound(new Error(error.message));
          case "NotAllowedError":
            return forbidden(new Error(error.message));
          default:
            return clientError(error.message);
        }
      }

      return ok();
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: err.issues });
      }
      return fail(err as Error);
    }
  }
}
