import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { Service } from "../../../../enterprise/entities/service";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";

export interface ToggleServiceActivationDTO {
  barbershopId: string;
  serviceId: string;
  userId: string;
  isActive: boolean;
}

export type ToggleServiceActivationResponse = Either<
  ResourceNotFoundError | NotAllowedError | Error,
  { service: Service }
>;

export class ToggleServiceActivationUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private servicesRepository: ServicesRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute({
    barbershopId,
    serviceId,
    userId,
    isActive,
  }: ToggleServiceActivationDTO): Promise<ToggleServiceActivationResponse> {
    const action = async (): Promise<ToggleServiceActivationResponse> => {
      const barbershop =
        await this.barbershopsRepository.findById(barbershopId);

      if (!barbershop) {
        return left(new ResourceNotFoundError("Barbearia não encontrada."));
      }

      if (barbershop.ownerId.toString() !== userId) {
        return left(new NotAllowedError());
      }

      const service = await this.servicesRepository.findByIdAndBarbershopId(
        serviceId,
        barbershopId,
      );

      if (!service) {
        return left(new ResourceNotFoundError("Serviço não encontrado."));
      }

      if (isActive) {
        service.activate();
      } else {
        service.deactivate();
      }

      await this.servicesRepository.save(service);

      return right({ service });
    };

    if (this.unitOfWork) {
      return this.unitOfWork.withLocks({ unitIds: [barbershopId] }, action);
    }

    return action();
  }
}
