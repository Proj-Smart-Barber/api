import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type {
  FeedbacksResponse,
  ReviewInsightsRepository,
  ReviewSourceFilter,
} from "../../../repositories/review-insights-repository";
import type { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { ValidationError } from "../../_errors/validation-error";
import { ensureOwnerAccess } from "./ensure-owner-access";
import { resolveOptionalPeriod } from "./period-utils";

export interface GetOwnerFeedbacksDTO {
  shopId: string;
  actorId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  source?: ReviewSourceFilter;
  targetType?: "ALL" | "BARBERSHOP" | "BARBER" | "SERVICE";
  targetId?: string;
  rating?: number;
  hasComment?: boolean;
  page?: number;
  limit?: number;
}

export type GetOwnerFeedbacksResponse = Either<
  ResourceNotFoundError | NotAllowedError | ValidationError,
  FeedbacksResponse
>;

export class GetOwnerFeedbacksUseCase {
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
    targetType = "ALL",
    targetId,
    rating,
    hasComment,
    page = 1,
    limit = 20,
  }: GetOwnerFeedbacksDTO): Promise<GetOwnerFeedbacksResponse> {
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

    const result = await this.reviewInsightsRepository.getFeedbacks({
      barbershopId: shopId,
      startDate: periodResult.value.startDate,
      endDate: periodResult.value.endDate,
      source,
      targetType,
      targetId,
      rating,
      hasComment,
      page,
      limit,
    });

    return right(result);
  }
}
