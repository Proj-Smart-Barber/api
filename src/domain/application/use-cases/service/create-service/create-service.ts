import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import { Service } from "../../../../enterprise/entities/service";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

export interface CreateServiceDTO {
  barbershopId: string;
  userId: string;
  title: string;
  description?: string;
  priceInCents: number;
  durationInMinutes: number;
}

export type CreateServiceResponse = Either<
  ResourceNotFoundError | NotAllowedError | Error,
  { service: Service }
>;

export class CreateServiceUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    barbershopId,
    userId,
    title,
    description,
    priceInCents,
    durationInMinutes,
  }: CreateServiceDTO): Promise<CreateServiceResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.status !== "ACTIVE") {
      return left(new ResourceNotFoundError("Barbearia inativa."));
    }

    if (barbershop.ownerId.toString() !== userId) {
      return left(new NotAllowedError());
    }

    const trimmedTitle = title?.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      return left(
        new Error("O título do serviço deve ter no mínimo 2 caracteres."),
      );
    }

    if (!Number.isInteger(priceInCents) || priceInCents <= 0) {
      return left(
        new Error("O preço em centavos deve ser um número inteiro positivo."),
      );
    }

    if (!Number.isInteger(durationInMinutes) || durationInMinutes <= 0) {
      return left(
        new Error("A duração em minutos deve ser um número inteiro positivo."),
      );
    }

    const trimmedDescription = description?.trim();
    if (trimmedDescription && trimmedDescription.length > 500) {
      return left(new Error("A descrição não pode exceder 500 caracteres."));
    }

    const service = Service.create({
      barbershopId: barbershop.id,
      title: trimmedTitle,
      description: trimmedDescription || undefined,
      priceInCents,
      durationInMinutes,
      isActive: true,
    });

    await this.servicesRepository.create(service);

    return right({ service });
  }
}
