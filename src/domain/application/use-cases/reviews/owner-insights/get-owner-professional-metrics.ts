import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type {
  ProfessionalMetricsResponse,
  ReviewInsightsRepository,
  ReviewSourceFilter,
} from "../../../repositories/review-insights-repository";
import type { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { ValidationError } from "../../_errors/validation-error";
import { ensureOwnerAccess } from "./ensure-owner-access";
import { resolveOptionalPeriod } from "./period-utils";

export interface GetOwnerProfessionalMetricsDTO {
  shopId: string;
  actorId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  source?: ReviewSourceFilter;
  page?: number;
  limit?: number;
}

export type GetOwnerProfessionalMetricsResponse = Either<
  ResourceNotFoundError | NotAllowedError | ValidationError,
  ProfessionalMetricsResponse
>;

export class GetOwnerProfessionalMetricsUseCase {
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
    page = 1,
    limit = 20,
  }: GetOwnerProfessionalMetricsDTO): Promise<GetOwnerProfessionalMetricsResponse> {
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

    const result = await this.reviewInsightsRepository.getProfessionalMetrics({
      barbershopId: shopId,
      startDate: periodResult.value.startDate,
      endDate: periodResult.value.endDate,
      source,
      page,
      limit,
    });

    return right(result);
  }
}
