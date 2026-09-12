import type { Controller } from "@/core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  fail,
} from "@/core/infra/http-response";
import type { UpdateBarbershopScheduleUseCase } from "@/domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { z } from "zod";

export class UpdateBarbershopScheduleController implements Controller {
  constructor(
    private updateBarbershopScheduleUseCase: UpdateBarbershopScheduleUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      createdBy: z.string().default("mock-user-id"),
      dayOfWeek: z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ]),
      openTime: z.string(),
      closeTime: z.string(),
      barbermanId: z.string().nullable().optional(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.updateBarbershopScheduleUseCase.execute({
        barbershopId: parsedData.shopId,
        createdBy: parsedData.createdBy,
        dayOfWeek: parsedData.dayOfWeek,
        openTime: parsedData.openTime,
        closeTime: parsedData.closeTime,
        barbermanId: parsedData.barbermanId,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError(error.message);
      }

      return ok({
        scheduleId: result.value.schedule.id.toString(),
        message: "Jornada atualizada com sucesso.",
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: (err as any).errors });
      }
      return fail(err);
    }
  }
}
