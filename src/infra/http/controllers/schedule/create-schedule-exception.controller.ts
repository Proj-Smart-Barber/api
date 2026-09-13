import type { Controller } from "@/core/infra/controller";
import {
  type HttpResponse,
  clientError,
  created,
  fail,
} from "@/core/infra/http-response";
import type { CreateScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/create-schedule-exception/create-schedule-exception";
import { z } from "zod";

export class CreateScheduleExceptionController implements Controller {
  constructor(
    private createScheduleExceptionUseCase: CreateScheduleExceptionUseCase,
  ) {}

  async handle(request: unknown): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      userId: z.string().uuid(),
      date: z.string(),
      barbermanId: z.string().nullable().optional(),
      startTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable()
        .optional(),
      endTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable()
        .optional(),
      reason: z.string().nullable().optional(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.createScheduleExceptionUseCase.execute({
        barbershopId: parsedData.shopId,
        staffId: parsedData.userId,
        date: parsedData.date,
        barbermanId: parsedData.barbermanId,
        startTime: parsedData.startTime,
        endTime: parsedData.endTime,
        reason: parsedData.reason,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError(error.message);
      }

      return created({
        exceptionId: result.value.exception.id.toString(),
        message: "Exceção de jornada criada com sucesso.",
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: err.issues });
      }
      return fail(err as Error);
    }
  }
}
