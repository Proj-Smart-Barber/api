import type { Controller } from "@/core/infra/controller";
import {
  type HttpResponse,
  clientError,
  noContent,
  fail,
} from "@/core/infra/http-response";
import type { DeleteScheduleExceptionUseCase } from "@/domain/application/use-cases/schedule/delete-schedule-exception/delete-schedule-exception";
import { z } from "zod";

export class DeleteScheduleExceptionController implements Controller {
  constructor(
    private deleteScheduleExceptionUseCase: DeleteScheduleExceptionUseCase,
  ) {}

  async handle(request: any): Promise<HttpResponse> {
    const schema = z.object({
      exceptionId: z.string(),
    });

    try {
      const parsedData = schema.parse(request);

      const result = await this.deleteScheduleExceptionUseCase.execute({
        exceptionId: parsedData.exceptionId,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError(error.message);
      }

      return noContent();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return clientError({ errors: (err as any).errors });
      }
      return fail(err);
    }
  }
}
