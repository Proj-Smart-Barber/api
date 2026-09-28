import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { Service } from "../../../../enterprise/entities/service";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

export interface ListServicesDTO {
  barbershopId: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  userId?: string;
}

export type ListServicesResponse = Either<
  ResourceNotFoundError | NotAllowedError | Error,
  {
    items: Service[];
    total: number;
    page: number;
    limit: number;
  }
>;

export class ListServicesUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    barbershopId,
    page = 1,
    limit = 20,
    includeInactive = false,
    userId,
  }: ListServicesDTO): Promise<ListServicesResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    // Public readers can only access ACTIVE barbershops
    if (!includeInactive && barbershop.status !== "ACTIVE") {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    // includeInactive is restricted to the OWNER of the barbershop
    if (includeInactive) {
      if (!userId || barbershop.ownerId.toString() !== userId) {
        return left(new NotAllowedError());
      }
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const { services, total } =
      await this.servicesRepository.findManyByBarbershopId(barbershopId, {
        page: safePage,
        limit: safeLimit,
        includeInactive: !!includeInactive,
      });

    return right({
      items: services,
      total,
      page: safePage,
      limit: safeLimit,
    });
  }
}
