import { ZodError, z } from "zod";
import type { Controller } from "@/core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "@/core/infra/http-response";
import type { FetchBarbermanDailyScheduleWithDetailsUseCase } from "@/domain/application/use-cases/booking/fetch-barberman-daily-schedule-with-details/fetch-barberman-daily-schedule-with-details";
import { BookingDetailsMapper } from "@/domain/enterprise/mappers/booking-details-mapper";

const fetchBarbermanDailyScheduleWithDetailsControllerRequest = z.object({
  barbermanId: z.string().uuid(),
  date: z.coerce.date(),
});

type FetchBarbermanDailyScheduleWithDetailsControllerRequest = z.infer<
  typeof fetchBarbermanDailyScheduleWithDetailsControllerRequest
>;

export class FetchBarbermanDailyScheduleWithDetailsController
  implements Controller
{
  constructor(
    private fetchBarbermanDailyScheduleWithDetailsUseCase: FetchBarbermanDailyScheduleWithDetailsUseCase,
  ) {}

  async handle(
    request: FetchBarbermanDailyScheduleWithDetailsControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { barbermanId, date } =
        fetchBarbermanDailyScheduleWithDetailsControllerRequest.parse(request);

      const result =
        await this.fetchBarbermanDailyScheduleWithDetailsUseCase.execute({
          barbermanId,
          date,
        });

      if (result.isLeft()) {
        return clientError("Erro ao buscar agenda detalhada do barbeiro.");
      }

      const { bookings } = result.value;

      return ok({
        bookings: bookings.map((booking) =>
          BookingDetailsMapper.toHTTP(booking),
        ),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
