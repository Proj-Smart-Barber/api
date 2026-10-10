import { type Either, left, right } from "../../../../../core/logic/either";
import { ServiceItem } from "../../../../enterprise/entities/service-item";
import type { ServiceItemsRepository } from "../../../repositories/service-items-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { CreateServiceItemDTO } from "./create-service-item-dto";
import type { CreateServiceItemResponse } from "./create-service-item-response";

type CreateServiceItemUseCaseResponse = Either<
  Error,
  CreateServiceItemResponse
>;

export class CreateServiceItemUseCase {
  constructor(
    private servicesRepository: ServicesRepository,
    private serviceItemsRepository: ServiceItemsRepository,
  ) {}

  async execute({
    serviceId,
  }: CreateServiceItemDTO): Promise<CreateServiceItemUseCaseResponse> {
    const service = await this.servicesRepository.findById(serviceId);

    if (!service || !service.isActive) {
      return left(
        new ResourceNotFoundError("Serviço não encontrado ou inativo."),
      );
    }

    const serviceItem = ServiceItem.create({
      serviceId: new UniqueEntityId(serviceId),
      titleSnapshot: service.title,
      priceInCentsSnapshot: service.priceInCents,
      durationInMinutesSnapshot: service.durationInMinutes,
    });

    await this.serviceItemsRepository.create(serviceItem);

    return right({ serviceItem });
  }
}
