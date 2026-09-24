import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  fail,
} from "../../../../core/infra/http-response";
import type { UpdateBarbershopScheduleUseCase } from "../../../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { z } from "zod";

export class UpdateBarbershopScheduleController implements Controller {
  constructor(
    private updateBarbershopScheduleUseCase: UpdateBarbershopScheduleUseCase,
  ) {}

  async handle(request: unknown): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      userId: z.string().uuid(),
      barbermanId: z.string().nullable().optional(),
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

      const result = await this.updateBarbershopScheduleUseCase.execute({
        barbershopId: parsedData.shopId,
        barbermanId: parsedData.barbermanId ?? null,
        createdBy: parsedData.userId,
        schedules: parsedData.schedules,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError(error.message);
      }

      return ok({
        message: "Jornada atualizada com sucesso.",
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: err.issues });
      }
      return fail(err as Error);
    }
  }
}
