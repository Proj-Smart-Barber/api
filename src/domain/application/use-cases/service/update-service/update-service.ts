import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { Service } from "../../../../enterprise/entities/service";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

export interface UpdateServiceDTO {
  barbershopId: string;
  serviceId: string;
  userId: string;
  title?: string;
  description?: string;
  priceInCents?: number;
  durationInMinutes?: number;
}

export type UpdateServiceResponse = Either<
  ResourceNotFoundError | NotAllowedError | Error,
  { service: Service }
>;

export class UpdateServiceUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    barbershopId,
    serviceId,
    userId,
    title,
    description,
    priceInCents,
    durationInMinutes,
  }: UpdateServiceDTO): Promise<UpdateServiceResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

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

    let updatedTitle: string | undefined;
    if (title !== undefined) {
      updatedTitle = title.trim();
      if (updatedTitle.length < 2) {
        return left(
          new Error("O título do serviço deve ter no mínimo 2 caracteres."),
        );
      }
    }

    if (priceInCents !== undefined) {
      if (!Number.isInteger(priceInCents) || priceInCents <= 0) {
        return left(
          new Error("O preço em centavos deve ser um número inteiro positivo."),
        );
      }
    }

    if (durationInMinutes !== undefined) {
      if (!Number.isInteger(durationInMinutes) || durationInMinutes <= 0) {
        return left(
          new Error(
            "A duração em minutos deve ser um número inteiro positivo.",
          ),
        );
      }
    }

    let updatedDescription: string | undefined;
    if (description !== undefined) {
      updatedDescription = description.trim();
      if (updatedDescription.length > 500) {
        return left(new Error("A descrição não pode exceder 500 caracteres."));
      }
    }

    service.update({
      title: updatedTitle,
      description: description !== undefined ? updatedDescription : undefined,
      priceInCents,
      durationInMinutes,
    });

    await this.servicesRepository.save(service);

    return right({ service });
  }
}
