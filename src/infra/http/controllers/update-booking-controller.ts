import { ZodError, z } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  notFound,
  ok,
  fail,
  conflict,
  type HttpResponse,
  unauthorized,
} from "../../../core/infra/http-response";
import type { UpdateBookingUseCase } from "../../../domain/application/use-cases/booking/update-booking/update-booking";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";
import { UnauthorizedError } from "../../../domain/application/use-cases/_errors/unauthorized-error";
import { BookingConflictError } from "../../../domain/application/use-cases/_errors/booking-conflict-error";

const updateBookingControllerRequest = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.coerce.date().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

type UpdateBookingControllerRequest = z.infer<
  typeof updateBookingControllerRequest
>;

export class UpdateBookingController implements Controller {
  constructor(private updateBookingUseCase: UpdateBookingUseCase) {}

  async handle(request: UpdateBookingControllerRequest): Promise<HttpResponse> {
    try {
      const {
        bookingId,
        userId: barbermanId,
        date,
        startTime,
        endTime,
      } = updateBookingControllerRequest.parse(request);

      const result = await this.updateBookingUseCase.execute({
        bookingId,
        barbermanId,
        date,
        startTime,
        endTime,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound(error.message);
        }

        if (error instanceof UnauthorizedError) {
          return unauthorized(error.message);
        }

        if (error instanceof BookingConflictError) {
          return conflict(error.message);
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
        new Error("Internal server error. Failed to update booking."),
      );
    }
  }
}
