import type { Controller } from "@/core/infra/controller";
import {
  type HttpResponse,
  clientError,
  noContent,
  fail,
  forbidden,
  notFound,
} from "@/core/infra/http-response";
import type { DeleteScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/delete-schedule-exception/delete-schedule-exception";
import { z } from "zod";

export class DeleteScheduleExceptionController implements Controller {
  constructor(
    private deleteScheduleExceptionUseCase: DeleteScheduleExceptionUseCase,
  ) {}

  async handle(request: unknown): Promise<HttpResponse> {
    const schema = z.object({
      exceptionId: z.string().uuid(),
      shopId: z.string().uuid(),
      userId: z.string().uuid(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.deleteScheduleExceptionUseCase.execute({
        exceptionId: parsedData.exceptionId,
        barbershopId: parsedData.shopId,
        staffId: parsedData.userId,
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

      return noContent();
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: err.issues });
      }
      return fail(err as Error);
    }
  }
}
