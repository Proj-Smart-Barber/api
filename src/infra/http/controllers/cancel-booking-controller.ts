import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  notFound,
  ok,
  fail,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { CancelBookingUseCase } from "../../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { BookingMapper } from "@/domain/enterprise/mappers/booking-mapper";
const cancelBookingControllerRequest = z.object({
  bookingId: z.string().uuid(),
});

type CancelBookingControllerRequest = z.infer<
  typeof cancelBookingControllerRequest
>;

export class CancelBookingController implements Controller {
  constructor(private cancelBookingUseCase: CancelBookingUseCase) {}

  async handle(request: CancelBookingControllerRequest): Promise<HttpResponse> {
    try {
      const { bookingId } = cancelBookingControllerRequest.parse(request);

      const result = await this.cancelBookingUseCase.execute({ bookingId });

      if (result.isLeft()) {
        const error = result.value;

        return notFound(error.message);
      }

      const { booking } = result.value;

      return ok({
        booking: BookingMapper.toHTTP(booking),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(new Error(String(err)));
    }
  }
}
