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

const updateScheduleExceptionParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateScheduleExceptionBodySchema = z.object({
  date: z.string().date().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export class UpdateScheduleExceptionController implements Controller {
  constructor(
    private updateScheduleExceptionUseCase: UpdateScheduleExceptionUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const { exceptionId } = z
        .object({ exceptionId: z.string().uuid() })
        .parse(request);
      const { date, startTime, endTime, reason } =
        updateScheduleExceptionBodySchema.parse(request);

      const barbershopId = request.user?.barbershopId || request.shopId; // Fallback to shopId from params if user is not populated

      const result = await this.updateScheduleExceptionUseCase.execute({
        exceptionId,
        barbershopId,
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
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: (err as any).errors });
      }
      return fail(err);
    }
  }
}
