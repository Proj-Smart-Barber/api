import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type {
  ReviewInsightsRepository,
  ReviewSourceFilter,
  ServiceMetricsResponse,
} from "../../../repositories/review-insights-repository";
import type { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { ValidationError } from "../../_errors/validation-error";
import { ensureOwnerAccess } from "./ensure-owner-access";
import { resolveOptionalPeriod } from "./period-utils";

export interface GetOwnerServiceMetricsDTO {
  shopId: string;
  actorId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  source?: ReviewSourceFilter;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
}

export type GetOwnerServiceMetricsResponse = Either<
  ResourceNotFoundError | NotAllowedError | ValidationError,
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
    page = 1,
    limit = 20,
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

    const { barbershop } = authResult.value;
    const periodResult = resolveOptionalPeriod({
      startDate,
      endDate,
      timezone: barbershop.timezone,
      defaultDays: 30,
    });

    if (periodResult.isLeft()) {
      return left(periodResult.value);
    }

    const result = await this.reviewInsightsRepository.getServiceMetrics({
      barbershopId: shopId,
      startDate: periodResult.value.startDate,
      endDate: periodResult.value.endDate,
      source,
      includeInactive,
      page,
      limit,
    });

    return right(result);
  }
}
