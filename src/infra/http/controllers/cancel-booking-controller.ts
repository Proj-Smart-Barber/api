import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  notFound,
  ok,
  fail,
  forbidden,
  type HttpResponse,
  unauthorized,
} from "../../../core/infra/http-response";
import type { CancelBookingUseCase } from "../../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";
import { UnauthorizedError } from "../../../domain/application/use-cases/_errors/unauthorized-error";
const cancelBookingControllerRequest = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
});

type CancelBookingControllerRequest = z.infer<
  typeof cancelBookingControllerRequest
>;

export class CancelBookingController implements Controller {
  constructor(private cancelBookingUseCase: CancelBookingUseCase) {}

  async handle(request: CancelBookingControllerRequest): Promise<HttpResponse> {
    try {
      const { bookingId, userId: barbermanId } =
        cancelBookingControllerRequest.parse(request);

      const result = await this.cancelBookingUseCase.execute({
        bookingId,
        barbermanId,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound(error.message);
        }

        if (error instanceof UnauthorizedError) {
          return unauthorized(error.message);
        }

        return clientError(error);
      }

      const { booking } = result.value;

      return ok({
        booking: BookingMapper.toHTTP(booking),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError(z.prettifyError(err));
      }

      return fail(
        new Error("Internal server error. Failed to cancel booking."),
      );
    }
  }
}
