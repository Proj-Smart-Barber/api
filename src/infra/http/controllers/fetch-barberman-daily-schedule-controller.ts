import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  ok,
  fail,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { FetchBarbermanDailyScheduleUseCase } from "../../../domain/application/use-cases/booking/fetch-staff-barberman-schedule/fetch-barberman-daily-schedule";

const fetchBarbermanDailyScheduleControllerRequest = z.object({
  barbermanId: z.string().uuid(),
  date: z.coerce.date(),
});

type FetchBarbermanDailyScheduleControllerRequest = z.infer<
  typeof fetchBarbermanDailyScheduleControllerRequest
>;

export class FetchBarbermanDailyScheduleController implements Controller {
  constructor(
    private fetchBarbermanDailyScheduleUseCase: FetchBarbermanDailyScheduleUseCase,
  ) {}

  async handle(
    request: FetchBarbermanDailyScheduleControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { barbermanId, date } =
        fetchBarbermanDailyScheduleControllerRequest.parse(request);

      const result = await this.fetchBarbermanDailyScheduleUseCase.execute({
        barbermanId,
        date,
      });

      if (result.isLeft()) {
        return clientError("Erro ao buscar agenda diária do barbeiro.");
      }

      const { bookings } = result.value;

      return ok({ bookings });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
