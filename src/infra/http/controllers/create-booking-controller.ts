import { z, ZodError } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  conflict,
  created,
  fail,
  notFound,
  type HttpResponse,
} from "../../../core/infra/http-response";
import { BookingConflictError } from "../../../domain/application/use-cases/_errors/booking-conflict-error";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { CreateBookingUseCase } from "../../../domain/application/use-cases/booking/create-booking/create-booking";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";

const createBookingControllerRequest = z.object({
  userId: z.string().uuid(),
  serviceId: z.string().uuid(),
  barbermanId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início inválido."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fim inválido."),
});

type CreateBookingControllerRequest = z.infer<
  typeof createBookingControllerRequest
>;

export class CreateBookingController implements Controller {
  constructor(private createBookingUseCase: CreateBookingUseCase) {}

  async handle(request: CreateBookingControllerRequest): Promise<HttpResponse> {
    try {
      const {
        userId: customerId,
        serviceId,
        barbermanId,
        date,
        startTime,
        endTime,
      } = createBookingControllerRequest.parse(request);

      const result = await this.createBookingUseCase.execute({
        customerId,
        serviceId,
        barbermanId,
        date,
        startTime,
        endTime,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message });
        }

        if (error instanceof BookingConflictError) {
          return conflict({ error: error.message });
        }

        return clientError({ error: error.message });
      }

      const { booking } = result.value;

      return created({
        booking: BookingMapper.toHTTP(booking),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ error: z.prettifyError(err) });
      }

      return fail(
        new Error("Internal server error. Failed to create booking."),
      );
    }
  }
}
