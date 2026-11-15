import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type {
  ReviewInsightsRepository,
  ReviewSourceFilter,
  ReviewSummaryMetrics,
  ReviewTimeSeriesGranularity,
} from "../../../repositories/review-insights-repository";
import type { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { ValidationError } from "../../_errors/validation-error";
import { ensureOwnerAccess } from "./ensure-owner-access";
import { resolveRequiredPeriod } from "./period-utils";

export interface GetOwnerReviewSummaryDTO {
  shopId: string;
  actorId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  source?: ReviewSourceFilter;
  granularity?: ReviewTimeSeriesGranularity;
}

export type GetOwnerReviewSummaryResponse = Either<
  ResourceNotFoundError | NotAllowedError | ValidationError,
  ReviewSummaryMetrics
>;

export class GetOwnerReviewSummaryUseCase {
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
    granularity = "WEEK",
  }: GetOwnerReviewSummaryDTO): Promise<GetOwnerReviewSummaryResponse> {
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
    const periodResult = resolveRequiredPeriod({
      startDate,
      endDate,
      timezone: barbershop.timezone,
      defaultDays: 30,
    });

    if (periodResult.isLeft()) {
      return left(periodResult.value);
    }

    const {
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      timezone,
    } = periodResult.value;

    const summary = await this.reviewInsightsRepository.getSummaryMetrics({
      barbershopId: shopId,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      source,
      timezone,
      granularity,
    });

    return right(summary);
  }
}
