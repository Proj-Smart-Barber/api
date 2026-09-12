import type { Controller } from "@/core/infra/controller";
import { type HttpResponse, ok, fail } from "@/core/infra/http-response";
import type { FetchScheduleExceptionsUseCase } from "@/domain/application/use-cases/schedule/fetch-schedule-exceptions/fetch-schedule-exceptions";
import { z } from "zod";

export class FetchScheduleExceptionsController implements Controller {
  constructor(
    private fetchScheduleExceptionsUseCase: FetchScheduleExceptionsUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      barbermanId: z.string().optional(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.fetchScheduleExceptionsUseCase.execute({
        barbershopId: parsedData.shopId,
        barbermanId: parsedData.barbermanId,
      });

      if (result.isLeft()) {
        return fail(new Error("Failed to fetch exceptions"));
      }

      const exceptions = result.value.exceptions.map((e) => ({
        id: e.id.toString(),
        barbershopId: e.barbershopId.toString(),
        barbermanId: e.barbermanId?.toString() ?? null,
        date: e.date.toISOString(),
        startTime: e.startTime,
        endTime: e.endTime,
        reason: e.reason,
      }));

      return ok({ exceptions });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return fail((err as any).errors);
      }
      return fail(err as Error);
    }
  }
}
