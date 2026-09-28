import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { Service } from "../../../../enterprise/entities/service";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface GetServiceDTO {
  barbershopId: string;
  serviceId: string;
  userId?: string;
}

export type GetServiceResponse = Either<
  ResourceNotFoundError | Error,
  { service: Service }
>;

export class GetServiceUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    barbershopId,
    serviceId,
    userId,
  }: GetServiceDTO): Promise<GetServiceResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    const service = await this.servicesRepository.findByIdAndBarbershopId(
      serviceId,
      barbershopId,
    );

    if (!service) {
      return left(new ResourceNotFoundError("Serviço não encontrado."));
    }

    if (!service.isActive) {
      const isOwner = userId && barbershop.ownerId.toString() === userId;
      if (!isOwner) {
        return left(new ResourceNotFoundError("Serviço não encontrado."));
      }
    }

    return right({ service });
  }
}
