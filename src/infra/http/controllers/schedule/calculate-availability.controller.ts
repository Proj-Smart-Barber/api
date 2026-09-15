import type { Controller } from "@/core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  fail,
} from "@/core/infra/http-response";
import type { CalculateAvailabilityUseCase } from "@/domain/application/use-cases/schedule/calculate-availability";
import { z } from "zod";

export class CalculateAvailabilityController implements Controller {
  constructor(
    private calculateAvailabilityUseCase: CalculateAvailabilityUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      shopId: z.string(),
      date: z.string(),
      serviceIds: z
        .union([z.string(), z.array(z.string())])
        .transform((val) => {
          if (typeof val === "string") return val.split(",");
          return val;
        }),
      barbermanId: z.string().nullable().optional(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.calculateAvailabilityUseCase.execute({
        barbershopId: parsedData.shopId,
        date: parsedData.date,
        serviceIds: parsedData.serviceIds,
        barbermanId: parsedData.barbermanId,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError(error.message);
      }

      return ok({
        slots: result.value.availableSlots,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: (err as any).errors });
      }
      return fail(err);
    }
  }
}
