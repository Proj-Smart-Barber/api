import type { Controller } from "@/core/infra/controller";
import { type HttpResponse, ok, fail } from "@/core/infra/http-response";
import type { FetchBarbershopSchedulesUseCase } from "@/domain/application/use-cases/schedule/fetch-barbershop-schedules/fetch-barbershop-schedules";
import { z } from "zod";

export class FetchBarbershopSchedulesController implements Controller {
  constructor(
    private fetchBarbershopSchedulesUseCase: FetchBarbershopSchedulesUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      barbermanId: z.string().optional(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.fetchBarbershopSchedulesUseCase.execute({
        barbershopId: parsedData.shopId,
        barbermanId: parsedData.barbermanId,
      });

      if (result.isLeft()) {
        return fail(new Error("Failed to fetch schedules"));
      }

      const schedules = result.value.schedules.map((s) => ({
        id: s.id.toString(),
        barbershopId: s.barbershopId.toString(),
        barbermanId: s.barbermanId?.toString() ?? null,
        dayOfWeek: s.dayOfWeek,
        openTime: s.openTime,
        closeTime: s.closeTime,
      }));

      return ok({ schedules });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return fail((err as any).errors);
      }
      return fail(err as Error);
    }
  }
}
