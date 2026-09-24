import { type Either, left, right } from "../../../../../core/logic/either";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { Barbershop } from "../../../../enterprise/entities/barbershop";

interface GetBarbershopDTO {
  barbershopId: string;
}

type GetBarbershopResponse = Either<
  ResourceNotFoundError,
  {
    barbershop: Barbershop;
  }
>;

export class GetBarbershopUseCase {
  constructor(private barbershopsRepository: BarbershopsRepository) {}

  async execute({
    barbershopId,
  }: GetBarbershopDTO): Promise<GetBarbershopResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError());
    }

    return right({
      barbershop,
    });
  }
}
