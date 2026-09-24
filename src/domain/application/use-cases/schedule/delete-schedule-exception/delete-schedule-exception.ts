import { type Either, left, right } from "../../../../../core/logic/either";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

interface DeleteScheduleExceptionDTO {
  exceptionId: string;
  barbershopId: string;
  staffId: string;
}

type DeleteScheduleExceptionResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  null
>;

export class DeleteScheduleExceptionUseCase {
  constructor(
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute({
    exceptionId,
    barbershopId,
    staffId,
  }: DeleteScheduleExceptionDTO): Promise<DeleteScheduleExceptionResponse> {
    const exception =
      await this.scheduleExceptionsRepository.findById(exceptionId);

    if (!exception) {
      return left(new ResourceNotFoundError());
    }

    if (exception.barbershopId.toString() !== barbershopId) {
      return left(new NotAllowedError());
    }

    const barbershop = await this.barbershopsRepository.findById(barbershopId);
    if (!barbershop || barbershop.ownerId.toString() !== staffId) {
      return left(new NotAllowedError());
    }

    await this.scheduleExceptionsRepository.delete(exception);

    return right(null);
  }
}
