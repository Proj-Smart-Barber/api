import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  ok,
  fail,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { FetchBarbermanDailyScheduleUseCase } from "../../../domain/application/use-cases/booking/fetch-staff-barberman-schedule/fetch-barberman-daily-schedule";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";
const fetchBarbermanDailyScheduleControllerRequest = z.object({
  userId: z.string().uuid(),
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
      const { userId: barbermanId, date } =
        fetchBarbermanDailyScheduleControllerRequest.parse(request);

      const result = await this.fetchBarbermanDailyScheduleUseCase.execute({
        barbermanId,
        date,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError(error.message);
      }

      const { bookings } = result.value;

      return ok({
        bookings: bookings.map((booking) => BookingMapper.toHTTP(booking)),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(
        new Error("Internal server error. Failed to fetch schedule."),
      );
    }
  }
}
