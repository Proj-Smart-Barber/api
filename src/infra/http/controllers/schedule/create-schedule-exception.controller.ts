import type { Controller } from "@/core/infra/controller";
import {
  type HttpResponse,
  clientError,
  created,
  fail,
} from "@/core/infra/http-response";
import type { CreateScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/create-schedule-exception";
import { z } from "zod";

export class CreateScheduleExceptionController implements Controller {
  constructor(
    private createScheduleExceptionUseCase: CreateScheduleExceptionUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      date: z.string(),
      barbermanId: z.string().nullable().optional(),
      startTime: z.string().nullable().optional(),
      endTime: z.string().nullable().optional(),
      reason: z.string().nullable().optional(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.createScheduleExceptionUseCase.execute({
        barbershopId: parsedData.shopId,
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
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: err.errors });
      }
      return fail(err);
    }
  }
}
