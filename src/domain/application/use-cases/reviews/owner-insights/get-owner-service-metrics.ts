import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type {
  ReviewInsightsRepository,
  ServiceMetricsResponse,
} from "../../../repositories/review-insights-repository";
import type { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { ensureOwnerAccess } from "./ensure-owner-access";

export interface GetOwnerServiceMetricsDTO {
  shopId: string;
  actorId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  source?: "CUSTOMER" | "DEMO" | "ALL";
  includeInactive?: boolean;
}

export type GetOwnerServiceMetricsResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  ServiceMetricsResponse
>;

export class GetOwnerServiceMetricsUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository,
    private reviewInsightsRepository: ReviewInsightsRepository,
  ) {}

  async execute({
    shopId,
    actorId,
    startDate,
    endDate,
    source = "CUSTOMER",
    includeInactive = false,
  }: GetOwnerServiceMetricsDTO): Promise<GetOwnerServiceMetricsResponse> {
    const authResult = await ensureOwnerAccess(
      this.barbershopsRepository,
      this.membershipsRepository,
      shopId,
      actorId,
    );

    if (authResult.isLeft()) {
      return left(authResult.value);
    }

    const resolvedStartDate = startDate ? new Date(startDate) : undefined;
    const resolvedEndDate = endDate ? new Date(endDate) : undefined;

    const result = await this.reviewInsightsRepository.getServiceMetrics({
      barbershopId: shopId,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      source,
      includeInactive,
    });

    return right(result);
  }
}
